/**
 * useSimulation.js
 * Core state + logic for the Sensor Simulation Lab.
 * Handles: station/sensor selection, manual send, auto-random loop,
 * quick simulation modes, real-time chart data, log terminal,
 * and Socket.IO "sensor-update" event subscription.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../../services/authSession';
import {
  fetchStations,
  fetchSensorsByStation,
  fetchSensor,
  injectSensorReading,
} from '../services/simulator.api';

// ─── constants ────────────────────────────────────────────────────────────────
const SOCKET_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
const MAX_CHART_POINTS = 30;
const MAX_LOG_LINES = 200;

export function useSimulation() {
  // ── Selection state ──────────────────────────────────────────────────────
  const [stations, setStations]         = useState([]);
  const [sensors, setSensors]           = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedSensor, setSelectedSensor]   = useState('');
  const [sensorMeta, setSensorMeta]     = useState(null);  // full sensor object

  // ── Loading / error ──────────────────────────────────────────────────────
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingSensors, setLoadingSensors]   = useState(false);
  const [loadingMeta, setLoadingMeta]         = useState(false);
  const [sending, setSending]                 = useState(false);
  const [error, setError]                     = useState('');

  // ── Manual send ──────────────────────────────────────────────────────────
  const [manualValue, setManualValue]   = useState('');

  // ── Auto simulation ──────────────────────────────────────────────────────
  const [autoRunning, setAutoRunning]   = useState(false);
  const [autoMin, setAutoMin]           = useState(0);
  const [autoMax, setAutoMax]           = useState(100);
  const [autoInterval, setAutoInterval] = useState(1000);
  const autoTimerRef                    = useRef(null);

  // ── Quick modes ───────────────────────────────────────────────────────────
  const [activeMode, setActiveMode]     = useState(null); // 'normal'|'warning'|'critical'|'chaos'

  // ── Live chart data ──────────────────────────────────────────────────────
  const [chartData, setChartData]       = useState([]);  // [{ time, value }]

  // ── Current displayed value ───────────────────────────────────────────────
  const [liveValue, setLiveValue]       = useState(null);
  const [valueStatus, setValueStatus]   = useState('normal'); // 'normal'|'warning'|'critical'

  // ── Log terminal ─────────────────────────────────────────────────────────
  const [logs, setLogs]                 = useState([]);
  const [logCount, setLogCount]         = useState(0);

  // ── Socket ───────────────────────────────────────────────────────────────
  const socketRef = useRef(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // ── Stats ────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({ sent: 0, alerts: 0, minSeen: null, maxSeen: null });

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const addLog = useCallback((message, level = 'info') => {
    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    setLogs((prev) => {
      const next = [...prev, { id: Date.now() + Math.random(), time, message, level }];
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
    });
    setLogCount((c) => c + 1);
  }, []);

  const pushChartPoint = useCallback((value) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setChartData((prev) => {
      const next = [...prev, { time, value }];
      return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
    });
  }, []);

  const computeValueStatus = useCallback((value, sensor) => {
    if (!sensor) return 'normal';
    const min = sensor.minThreshold !== null && sensor.minThreshold !== undefined ? Number(sensor.minThreshold) : null;
    const max = sensor.maxThreshold !== null && sensor.maxThreshold !== undefined ? Number(sensor.maxThreshold) : null;
    if ((min !== null && value < min) || (max !== null && value > max)) {
      // Critical if far beyond threshold, warning if right at threshold
      const range = (max !== null && min !== null) ? (max - min) : 100;
      const overshoot = max !== null && value > max ? value - max : min !== null && value < min ? min - value : 0;
      return overshoot > range * 0.2 ? 'critical' : 'warning';
    }
    return 'normal';
  }, []);

  const sendValue = useCallback(async (value, sensor = sensorMeta) => {
    if (!sensor) return;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      setError('Invalid value — must be a number.');
      return;
    }
    try {
      setSending(true);
      setError('');
      await injectSensorReading(sensor.id, numVal);
      const status = computeValueStatus(numVal, sensor);
      setLiveValue(numVal);
      setValueStatus(status);
      pushChartPoint(numVal);
      setStats((s) => ({
        sent: s.sent + 1,
        alerts: status !== 'normal' ? s.alerts + 1 : s.alerts,
        minSeen: s.minSeen === null ? numVal : Math.min(s.minSeen, numVal),
        maxSeen: s.maxSeen === null ? numVal : Math.max(s.maxSeen, numVal),
      }));

      const threshold = status !== 'normal' ? ` ⚠ THRESHOLD ${status.toUpperCase()}` : '';
      addLog(`→ INJECT  sensor=${sensor.name}  value=${numVal} ${sensor.unit}${threshold}`, status !== 'normal' ? status : 'success');
    } catch (err) {
      const msg = err?.response?.data?.message ?? err.message ?? 'Request failed';
      setError(msg);
      addLog(`✗ ERROR   ${msg}`, 'error');
    } finally {
      setSending(false);
    }
  }, [sensorMeta, computeValueStatus, pushChartPoint, addLog]);

  // ─── Mode helpers ──────────────────────────────────────────────────────────
  const getModeRange = useCallback((mode, sensor) => {
    const min = sensor?.minThreshold !== null && sensor?.minThreshold !== undefined ? Number(sensor.minThreshold) : 0;
    const max = sensor?.maxThreshold !== null && sensor?.maxThreshold !== undefined ? Number(sensor.maxThreshold) : 100;
    const range = max - min || 100;
    switch (mode) {
      case 'normal':
        return { lo: min + range * 0.1, hi: max - range * 0.1 };
      case 'warning':
        return { lo: max - range * 0.05, hi: max + range * 0.05 };
      case 'critical':
        return { lo: max + range * 0.1, hi: max + range * 0.3 };
      case 'chaos':
        return { lo: min - range * 0.5, hi: max + range * 0.5 };
      default:
        return { lo: autoMin, hi: autoMax };
    }
  }, [autoMin, autoMax]);

  const randomInRange = (lo, hi) => Math.round((lo + Math.random() * (hi - lo)) * 100) / 100;

  // ─── Auto simulation loop ─────────────────────────────────────────────────
  const stopAuto = useCallback(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setAutoRunning(false);
    addLog('■ AUTO SIMULATION STOPPED', 'warning');
  }, [addLog]);

  const startAuto = useCallback((mode = null) => {
    if (!sensorMeta) return;
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);

    const modeLabel = mode ? mode.toUpperCase() : 'CUSTOM';
    addLog(`▶ AUTO SIMULATION STARTED  mode=${modeLabel}  interval=${autoInterval}ms`, 'system');
    setAutoRunning(true);
    setActiveMode(mode);

    autoTimerRef.current = setInterval(() => {
      const { lo, hi } = getModeRange(mode, sensorMeta);
      const val = randomInRange(lo, hi);
      sendValue(val, sensorMeta);
    }, autoInterval);
  }, [sensorMeta, autoInterval, getModeRange, sendValue, addLog]);

  // Cleanup auto timer on unmount
  useEffect(() => () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); }, []);

  // ─── Socket.IO subscription ───────────────────────────────────────────────
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('subscribe', { channel: 'sensors' });
      addLog('◉ SOCKET CONNECTED — subscribed to sensor channel', 'system');
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      addLog('◌ SOCKET DISCONNECTED', 'warning');
    });

    socket.on('sensor-update', (data) => {
      // Only display updates for the currently selected sensor
      if (selectedSensor && data.sensorId !== selectedSensor) return;
      addLog(`⚡ SOCKET  sensor-update  value=${data.value}  threshold=${data.thresholdViolated ? 'VIOLATED' : 'ok'}`, 'info');
    });

    socket.on('alert-created', (data) => {
      addLog(`🚨 ALERT  ${data.message ?? 'Alert triggered'}  severity=${data.severity}`, 'error');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSensor]);

  // ─── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingStations(true);
    addLog('LOADING STATIONS...', 'system');
    fetchStations()
      .then((data) => {
        setStations(Array.isArray(data) ? data : []);
        addLog(`✓ LOADED ${data.length} station(s)`, 'success');
      })
      .catch(() => addLog('✗ Failed to load stations', 'error'))
      .finally(() => setLoadingStations(false));
  }, [addLog]);

  useEffect(() => {
    if (!selectedStation) { setSensors([]); return; }
    setLoadingSensors(true);
    setSensors([]);
    setSelectedSensor('');
    setSensorMeta(null);
    addLog(`LOADING SENSORS for station ${selectedStation}...`, 'system');
    fetchSensorsByStation(selectedStation)
      .then((data) => {
        setSensors(Array.isArray(data) ? data : []);
        addLog(`✓ LOADED ${data.length} sensor(s)`, 'success');
      })
      .catch(() => addLog('✗ Failed to load sensors', 'error'))
      .finally(() => setLoadingSensors(false));
  }, [selectedStation, addLog]);

  useEffect(() => {
    if (!selectedSensor) { setSensorMeta(null); return; }
    setLoadingMeta(true);
    setSensorMeta(null);
    setChartData([]);
    setLiveValue(null);
    setStats({ sent: 0, alerts: 0, minSeen: null, maxSeen: null });
    stopAuto();
    setActiveMode(null);
    fetchSensor(selectedSensor)
      .then((data) => {
        setSensorMeta(data);
        if (data.lastReading !== null && data.lastReading !== undefined) {
          const v = Number(data.lastReading);
          setLiveValue(v);
          setValueStatus(computeValueStatus(v, data));
          pushChartPoint(v);
        }
        setAutoMin(data.minThreshold !== null ? Number(data.minThreshold) : 0);
        setAutoMax(data.maxThreshold !== null ? Number(data.maxThreshold) : 100);
        addLog(`✓ SENSOR LOADED  ${data.name}  type=${data.type}  unit=${data.unit}`, 'success');
        addLog(`  thresholds: min=${data.minThreshold ?? 'n/a'}  max=${data.maxThreshold ?? 'n/a'}`, 'info');
      })
      .catch(() => addLog('✗ Failed to load sensor metadata', 'error'))
      .finally(() => setLoadingMeta(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSensor]);

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    // selection
    stations, sensors,
    selectedStation, setSelectedStation,
    selectedSensor,  setSelectedSensor,
    sensorMeta,
    // loading
    loadingStations, loadingSensors, loadingMeta, sending,
    // manual
    manualValue, setManualValue,
    sendManual: () => sendValue(manualValue),
    // auto
    autoRunning, autoMin, setAutoMin, autoMax, setAutoMax,
    autoInterval, setAutoInterval,
    startAuto, stopAuto,
    // modes
    activeMode,
    startMode: (mode) => startAuto(mode),
    // chart + display
    chartData, liveValue, valueStatus,
    // log
    logs, logCount,
    // socket
    socketConnected,
    // stats
    stats,
    // misc
    error, setError,
  };
}
