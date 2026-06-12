/**
 * StationDetailTab — Tab 4: Station Detail
 *
 * Flow:
 *  1. Pick a station  → station health summary + multi-sensor trend chart
 *  2. Pick a sensor   → sensor KPI cards + min/max band chart + threshold lines
 *
 * Data sources:
 *  • stationStatus       (Redux)  — station dropdown + health card
 *  • sensors             (Redux)  — sensor dropdown, filtered by selected station
 *  • stationHistory      (local)  — getStationHistory() direct service call
 *  • sensorStats         (Redux)  — fetchSensorStats thunk
 *  • anomalyTimeline     (Redux)  — events filtered by station
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Line } from 'react-chartjs-2';
import {
  Badge, Card, CardBody, CardHeader, Col,
  FormGroup, Input, Label, Progress, Row, Spinner,
} from 'reactstrap';

import {
  fetchSensorStats,
  clearSensorStats,
  selectStationStatus,
  selectAnalyticsSensors,
  selectAnalyticsSensorStats,
  selectAnalyticsStatsLoading,
  selectAnalyticsStatsError,
  selectAnomalyTimeline,
} from '../../../store/slices/analyticsSlice';
import { analyticsService } from '../../../services/analyticsService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#5e72e4', '#2dce89', '#fb6340', '#11cdef',
  '#f5365c', '#fd7e14', '#8965e0', '#f3a4b5',
];

const STATUS_COLOR = {
  operational: 'success',
  active:      'success',
  maintenance: 'warning',
  offline:     'danger',
  inactive:    'secondary',
  faulty:      'danger',
  unknown:     'secondary',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtTs(iso, showDate = false) {
  if (!iso) return '—';
  const opts = showDate
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' };
  return new Date(iso).toLocaleString(undefined, opts);
}

function round3(v) {
  if (v == null || isNaN(Number(v))) return null;
  return +Number(v).toFixed(3);
}

function round2(v) {
  if (v == null || isNaN(Number(v))) return '—';
  return Number(v).toFixed(2);
}

/** Sample array to ≤ maxPts points for chart readability */
function sample(arr, maxPts = 80) {
  if (!arr || arr.length <= maxPts) return arr || [];
  const step = arr.length / maxPts;
  return arr.filter((_, i) => Math.round(i % step) === 0);
}

function EmptyState({ icon = 'ni-chart-bar-32', title, body }) {
  return (
    <div className="text-center py-5 text-muted">
      <i className={`ni ${icon} mb-3`} style={{ fontSize: '2rem', display: 'block', opacity: 0.35 }} />
      <h5 className="text-muted">{title}</h5>
      {body && <p className="mb-0 text-sm" style={{ maxWidth: 400, margin: '0 auto' }}>{body}</p>}
    </div>
  );
}

// ─── Chart builders ───────────────────────────────────────────────────────────

/** Multi-sensor line chart from station history. */
function buildStationChart(history, showDate) {
  if (!history?.sensors?.length) return null;

  // Use the first sensor's buckets for labels (all sensors share the same time axis)
  const buckets  = sample(history.sensors[0].buckets, 80);
  const labels   = buckets.map((b) => fmtTs(b.time, showDate));

  const datasets = history.sensors.slice(0, 8).map((s, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const pts   = sample(s.buckets, 80);
    return {
      label:           `${s.sensorName} (${s.unit})`,
      data:            pts.map((b) => round3(b.avg)),
      borderColor:     color,
      backgroundColor: color + '18',
      fill:            false,
      borderWidth:     2,
      pointRadius:     pts.length > 40 ? 0 : 3,
      tension:         0.3,
    };
  });

  return { labels, datasets };
}

/** Sensor detail chart: avg line + min/max band + optional threshold lines. */
function buildSensorChart(timeSeries, sensor, showDate) {
  if (!timeSeries?.length) return null;
  const pts    = sample(timeSeries, 90);
  const labels = pts.map((b) => fmtTs(b.time, showDate));
  const n      = pts.length;

  const datasets = [
    // Band top (max) — transparent border, no fill
    {
      label:       'Max',
      data:        pts.map((b) => round3(b.max)),
      borderColor: 'rgba(94,114,228,0.25)',
      borderWidth: 1,
      pointRadius: 0,
      fill:        false,
    },
    // Band bottom (min) — fills toward previous dataset (max) to create band
    {
      label:           'Min / Max range',
      data:            pts.map((b) => round3(b.min)),
      borderColor:     'rgba(94,114,228,0.25)',
      borderWidth:     1,
      pointRadius:     0,
      backgroundColor: 'rgba(94,114,228,0.08)',
      fill:            '-1',
    },
    // Average — solid main line
    {
      label:           'Average',
      data:            pts.map((b) => round3(b.avg)),
      borderColor:     '#5e72e4',
      backgroundColor: 'transparent',
      borderWidth:     2.5,
      pointRadius:     n > 40 ? 0 : 3,
      fill:            false,
    },
  ];

  // Add threshold lines if configured
  if (sensor?.maxThreshold != null) {
    datasets.push({
      label:       `Max threshold (${sensor.maxThreshold} ${sensor.unit})`,
      data:        Array(n).fill(Number(sensor.maxThreshold)),
      borderColor: '#f5365c',
      borderDash:  [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill:        false,
    });
  }
  if (sensor?.minThreshold != null) {
    datasets.push({
      label:       `Min threshold (${sensor.minThreshold} ${sensor.unit})`,
      data:        Array(n).fill(Number(sensor.minThreshold)),
      borderColor: '#fb6340',
      borderDash:  [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      fill:        false,
    });
  }

  return { labels, datasets };
}

// ─── Chart options ────────────────────────────────────────────────────────────

const stationChartOpts = {
  maintainAspectRatio: false,
  legend: {
    position: 'top',
    labels: { fontSize: 11, boxWidth: 12, usePointStyle: true },
  },
  scales: {
    xAxes: [{ ticks: { maxTicksLimit: 8, maxRotation: 35, fontSize: 10 } }],
    yAxes: [{ ticks: { beginAtZero: false } }],
  },
  tooltips: { mode: 'index', intersect: false },
  elements: { line: { tension: 0.3 } },
};

const sensorChartOpts = {
  maintainAspectRatio: false,
  legend: {
    position: 'top',
    labels: { fontSize: 11, boxWidth: 12, usePointStyle: true,
      // Hide max/min boundary labels (keep band label + avg + thresholds)
      filter: (item) => item.text !== 'Max' && item.text !== 'Min',
    },
  },
  scales: {
    xAxes: [{ ticks: { maxTicksLimit: 8, maxRotation: 35, fontSize: 10 } }],
    yAxes: [{ ticks: { beginAtZero: false } }],
  },
  tooltips: {
    mode: 'index',
    intersect: false,
    filter: (item) => item.datasetIndex >= 2, // only show avg + thresholds in tooltip
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, icon, color = 'primary', sub }) {
  return (
    <Card className="shadow-sm h-100">
      <CardBody className="py-3">
        <div className="d-flex justify-content-between align-items-start">
          <div style={{ minWidth: 0 }}>
            <p className="text-xs text-uppercase text-muted font-weight-bold mb-1">{label}</p>
            <h3 className="mb-0">
              {value ?? '—'}
              {unit && <small className="text-muted ml-1" style={{ fontSize: '0.7rem' }}>{unit}</small>}
            </h3>
            {sub && <small className="text-muted">{sub}</small>}
          </div>
          <div className={`icon icon-shape bg-${color} text-white rounded-circle shadow ml-2`}
            style={{ width: 40, height: 40, minWidth: 40, fontSize: '1rem' }}>
            <i className={`ni ${icon}`} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

const SEVERITY_BADGE = { critical: 'danger', error: 'warning', warning: 'warning', info: 'info' };

// ─── Main component ───────────────────────────────────────────────────────────

export default function StationDetailTab() {
  const dispatch = useDispatch();

  const stations   = useSelector(selectStationStatus);
  const allSensors = useSelector(selectAnalyticsSensors);
  const sensorStats = useSelector(selectAnalyticsSensorStats);
  const statsLoading = useSelector(selectAnalyticsStatsLoading);
  const statsError   = useSelector(selectAnalyticsStatsError);
  const allEvents    = useSelector(selectAnomalyTimeline);

  const [selectedStationId, setSelectedStationId] = useState('');
  const [selectedSensorId,  setSelectedSensorId]  = useState('');
  const [stationHistory,    setStationHistory]     = useState(null);
  const [historyLoading,    setHistoryLoading]     = useState(false);
  const [historyError,      setHistoryError]       = useState(null);
  const [period,            setPeriod]             = useState(24);  // hours

  // ── Derived: selected station + sensors in it ─────────────────────────────

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) || null,
    [stations, selectedStationId],
  );

  const stationSensors = useMemo(
    () => allSensors.filter((s) => s.station?.id === selectedStationId),
    [allSensors, selectedStationId],
  );

  const selectedSensor = useMemo(
    () => stationSensors.find((s) => s.id === selectedSensorId) || null,
    [stationSensors, selectedSensorId],
  );

  const stationEvents = useMemo(
    () => allEvents.filter((e) => e.station?.id === selectedStationId),
    [allEvents, selectedStationId],
  );

  const showDate = period > 48;

  // ── Fetch station history when station or period changes ──────────────────

  const loadHistory = useCallback(async (stationId, hours) => {
    if (!stationId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    setStationHistory(null);
    try {
      const from = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const data = await analyticsService.getStationHistory(stationId, { granularity: 'hour', from });
      setStationHistory(data);
    } catch (err) {
      setHistoryError('Could not load station history. The station may have no recorded data yet.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStationId) {
      setSelectedSensorId('');    // reset sensor pick when station changes
      dispatch(clearSensorStats());
      loadHistory(selectedStationId, period);
    }
  }, [selectedStationId, period, loadHistory, dispatch]);

  // ── Fetch sensor stats when sensor changes ────────────────────────────────

  useEffect(() => {
    if (!selectedSensorId) {
      dispatch(clearSensorStats());
      return;
    }
    const from = new Date(Date.now() - period * 60 * 60 * 1000).toISOString();
    dispatch(fetchSensorStats({ sensorId: selectedSensorId, params: { granularity: 'hour', from } }));
  }, [selectedSensorId, period, dispatch]);

  // Clear stats on unmount
  useEffect(() => () => { dispatch(clearSensorStats()); }, [dispatch]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const stationChart = useMemo(
    () => buildStationChart(stationHistory, showDate),
    [stationHistory, showDate],
  );

  const sensorChart = useMemo(
    () => buildSensorChart(
      sensorStats?.timeSeries,
      sensorStats?.sensor,
      showDate,
    ),
    [sensorStats, showDate],
  );

  // ── Health bar helper ─────────────────────────────────────────────────────

  const healthPct = selectedStation
    ? selectedStation.totalSensors > 0
      ? Math.round((selectedStation.activeSensors / selectedStation.totalSensors) * 100)
      : 0
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <Card className="shadow mb-4">
        <CardBody className="py-3 px-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <span
              className="text-xs text-uppercase font-weight-bold text-muted"
              style={{ letterSpacing: '0.06em' }}
            >
              <i className="ni ni-ui-04 mr-1" />
              Filters
            </span>
            {selectedStation && (
              <Badge
                color={STATUS_COLOR[selectedStation.status] || 'secondary'}
                className="text-sm px-3 py-1"
              >
                <i className="ni ni-building mr-1" />
                {selectedStation.name} — {selectedStation.status}
              </Badge>
            )}
          </div>

          <Row className="align-items-end" style={{ rowGap: 12 }}>
            <Col md="5" className="mb-0">
              <FormGroup className="mb-0">
                <Label className="form-control-label text-sm">Station</Label>
                <Input
                  type="select"
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  style={{ maxWidth: 340 }}
                >
                  <option value="">— Choose a monitoring station —</option>
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                      {st.openAlerts > 0 ? ` ⚠ ${st.openAlerts} alert${st.openAlerts > 1 ? 's' : ''}` : ''}
                    </option>
                  ))}
                </Input>
              </FormGroup>
            </Col>

            <Col md="auto" className="mb-0">
              <Label className="form-control-label text-sm d-block">Period</Label>
              <div className="d-flex" style={{ gap: 6 }}>
                {[
                  { label: '24 h', hours: 24  },
                  { label: '7 d',  hours: 168 },
                ].map(({ label, hours }) => (
                  <button
                    key={hours}
                    onClick={() => setPeriod(hours)}
                    className={`btn btn-sm ${period === hours ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Col>

            {selectedStation && stationSensors.length > 0 && (
              <Col md="5" className="mb-0">
                <FormGroup className="mb-0">
                  <Label className="form-control-label text-sm">Sensor</Label>
                  <Input
                    type="select"
                    value={selectedSensorId}
                    onChange={(e) => setSelectedSensorId(e.target.value)}
                    style={{ maxWidth: 340 }}
                  >
                    <option value="">— Choose a sensor —</option>
                    {stationSensors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type} · {s.unit})
                        {s.status !== 'active' ? ` — ${s.status}` : ''}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            )}
          </Row>

          {selectedStation && stationSensors.length === 0 && (
            <p className="text-xs text-muted mt-3 mb-0">
              <i className="ni ni-info mr-1" />
              No sensor records for this station yet — data populates automatically once sensors begin reporting.
            </p>
          )}
        </CardBody>
      </Card>

      {/* ── No station selected placeholder ───────────────────────────────── */}
      {!selectedStationId && (
        <Card className="shadow">
          <CardBody>
            <EmptyState
              icon="ni-building"
              title="Select a monitoring station"
              body="Choose a station from the dropdown above to view its real-time health summary, sensor trend chart, and individual sensor analysis."
            />
          </CardBody>
        </Card>
      )}

      {/* ── Station health summary ─────────────────────────────────────────── */}
      {selectedStation && (
        <Row className="mb-4">
          {[
            {
              label: 'Active sensors',
              value: `${selectedStation.activeSensors} / ${selectedStation.totalSensors}`,
              icon:  'ni-chart-bar-32',
              color: selectedStation.activeSensors === selectedStation.totalSensors ? 'success' : 'warning',
              sub:   `${selectedStation.offlineSensors} offline · ${selectedStation.faultySensors} faulty`,
            },
            {
              label: 'Open alerts',
              value: selectedStation.openAlerts,
              icon:  'ni-bell-55',
              color: selectedStation.openAlerts > 0 ? 'danger' : 'success',
              sub:   selectedStation.openAlerts === 0 ? 'No active alerts' : 'requires attention',
            },
            {
              label: 'Last measurement',
              value: relativeTime(selectedStation.lastReadingAt),
              icon:  'ni-time-alarm',
              color: selectedStation.lastReadingAt ? 'primary' : 'secondary',
              sub:   selectedStation.type || selectedStation.location || '',
            },
            {
              label: 'Sensor health',
              value: `${healthPct}%`,
              icon:  'ni-satisfied',
              color: healthPct >= 80 ? 'success' : healthPct >= 50 ? 'warning' : 'danger',
              sub:   'active sensor ratio',
            },
          ].map((c) => (
            <Col key={c.label} lg="3" md="6" className="mb-3">
              <KpiCard {...c} />
            </Col>
          ))}

          {/* Health progress bar */}
          <Col xs="12">
            <Card className="shadow-sm mt-1">
              <CardBody className="py-2 px-4">
                <div className="d-flex align-items-center" style={{ gap: 10 }}>
                  <small className="text-muted font-weight-bold" style={{ width: 110 }}>Sensor health</small>
                  <Progress
                    value={healthPct}
                    color={healthPct >= 80 ? 'success' : healthPct >= 50 ? 'warning' : 'danger'}
                    style={{ flex: 1, height: 6, borderRadius: 3 }}
                  />
                  <small className="text-muted" style={{ width: 36 }}>{healthPct}%</small>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Station multi-sensor trend chart ──────────────────────────────── */}
      {selectedStation && (
        <Row className="mb-4">
          <Col>
            <Card className="shadow">
              <CardHeader className="border-0">
                <h3 className="mb-0">
                  {selectedStation.name} — All Sensors
                  {stationHistory?.sensors?.length > 0 && (
                    <small className="text-muted ml-2" style={{ fontWeight: 400 }}>
                      ({stationHistory.sensors.length} sensor{stationHistory.sensors.length !== 1 ? 's' : ''})
                    </small>
                  )}
                </h3>
                <p className="text-muted text-sm mb-0">
                  Hourly average readings for every sensor at this station over the last {period < 48 ? `${period}h` : `${period / 24}d`}
                </p>
              </CardHeader>
              <CardBody>
                {historyLoading ? (
                  <div className="text-center py-5"><Spinner color="primary" /></div>
                ) : historyError ? (
                  <div className="alert alert-warning mb-0">{historyError}</div>
                ) : !stationChart ? (
                  <EmptyState
                    icon="ni-chart-bar-32"
                    title="No historical data yet"
                    body="Sensor readings will appear here once data has been collected for this station. Ensure sensors are active and reporting."
                  />
                ) : (
                  <div style={{ height: 300 }}>
                    <Line data={stationChart} options={stationChartOpts} />
                  </div>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Sensor detail panel ────────────────────────────────────────────── */}
      {selectedSensorId && (
        <>
          {/* KPI stat cards */}
          <Row className="mb-4">
            {statsLoading ? (
              <Col className="text-center py-4"><Spinner color="primary" /></Col>
            ) : statsError ? (
              <Col><div className="alert alert-warning">{statsError}</div></Col>
            ) : sensorStats ? (
              <>
                {[
                  {
                    label: 'Average',
                    value: round2(sensorStats.stats?.avg),
                    unit:  sensorStats.sensor?.unit,
                    icon:  'ni-align-center',
                    color: 'primary',
                    sub:   `${Number(sensorStats.stats?.count || 0).toLocaleString()} readings`,
                  },
                  {
                    label: 'Minimum',
                    value: round2(sensorStats.stats?.min),
                    unit:  sensorStats.sensor?.unit,
                    icon:  'ni-bold-down',
                    color: sensorStats.sensor?.minThreshold != null &&
                           sensorStats.stats?.min < sensorStats.sensor.minThreshold
                      ? 'danger' : 'info',
                    sub:   sensorStats.sensor?.minThreshold != null
                      ? `threshold: ${sensorStats.sensor.minThreshold}` : 'no threshold set',
                  },
                  {
                    label: 'Maximum',
                    value: round2(sensorStats.stats?.max),
                    unit:  sensorStats.sensor?.unit,
                    icon:  'ni-bold-up',
                    color: sensorStats.sensor?.maxThreshold != null &&
                           sensorStats.stats?.max > sensorStats.sensor.maxThreshold
                      ? 'danger' : 'warning',
                    sub:   sensorStats.sensor?.maxThreshold != null
                      ? `threshold: ${sensorStats.sensor.maxThreshold}` : 'no threshold set',
                  },
                  {
                    label: 'Std. deviation',
                    value: round2(sensorStats.stats?.stddev),
                    unit:  sensorStats.sensor?.unit,
                    icon:  'ni-chart-bar-32',
                    color: 'secondary',
                    sub:   'reading variability',
                  },
                ].map((c) => (
                  <Col key={c.label} lg="3" md="6" className="mb-3">
                    <KpiCard {...c} />
                  </Col>
                ))}

                {/* Threshold band indicator */}
                {(sensorStats.sensor?.minThreshold != null || sensorStats.sensor?.maxThreshold != null) && (
                  <Col xs="12" className="mb-2">
                    <Card className="shadow-sm">
                      <CardBody className="py-2 px-4">
                        <div className="d-flex align-items-center flex-wrap" style={{ gap: 12 }}>
                          <small className="text-muted font-weight-bold">Operating range:</small>
                          {sensorStats.sensor?.minThreshold != null && (
                            <Badge color="info" className="text-sm">
                              Min threshold: {sensorStats.sensor.minThreshold} {sensorStats.sensor.unit}
                            </Badge>
                          )}
                          {sensorStats.sensor?.maxThreshold != null && (
                            <Badge color="warning" className="text-sm">
                              Max threshold: {sensorStats.sensor.maxThreshold} {sensorStats.sensor.unit}
                            </Badge>
                          )}
                          <Badge color={sensorStats.sensor?.status === 'active' ? 'success' : 'secondary'}>
                            {sensorStats.sensor?.status}
                          </Badge>
                        </div>
                      </CardBody>
                    </Card>
                  </Col>
                )}
              </>
            ) : null}
          </Row>

          {/* Sensor time series chart */}
          <Row className="mb-4">
            <Col>
              <Card className="shadow">
                <CardHeader className="border-0">
                  <h3 className="mb-0">
                    {sensorStats?.sensor?.name || selectedSensor?.name || 'Sensor'} — Detailed Reading History
                  </h3>
                  <p className="text-muted text-sm mb-0">
                    Average, min/max range, and threshold lines over the selected period
                    {sensorStats?.sensor?.unit && ` · unit: ${sensorStats.sensor.unit}`}
                  </p>
                </CardHeader>
                <CardBody>
                  {statsLoading ? (
                    <div className="text-center py-5"><Spinner color="primary" /></div>
                  ) : !sensorChart ? (
                    <EmptyState
                      icon="ni-chart-bar-32"
                      title="No time-series data"
                      body="Historical readings for this sensor will appear once data has been recorded. Ensure the sensor is active and reporting."
                    />
                  ) : (
                    <div style={{ height: 300 }}>
                      <Line data={sensorChart} options={sensorChartOpts} />
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── Station event history ──────────────────────────────────────────── */}
      {selectedStation && (
        <Row>
          <Col>
            <Card className="shadow">
              <CardHeader className="border-0 d-flex justify-content-between align-items-center">
                <div>
                  <h3 className="mb-0">Recent Events — {selectedStation.name}</h3>
                  <p className="text-muted text-sm mb-0">
                    Anomaly and threshold events recorded for this station (from active monitoring period)
                  </p>
                </div>
                {stationEvents.length > 0 && (
                  <Badge color="danger" pill>{stationEvents.length}</Badge>
                )}
              </CardHeader>
              <CardBody className="p-0">
                {!stationEvents.length ? (
                  <EmptyState
                    icon="ni-check-bold"
                    title="No events for this station"
                    body="No anomalies or threshold violations were recorded for this station in the active monitoring window."
                  />
                ) : (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <table className="table align-items-center table-flush mb-0">
                      <thead className="thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ width: 140 }}>Time</th>
                          <th style={{ width: 90 }}>Severity</th>
                          <th>Sensor</th>
                          <th>Description</th>
                          <th style={{ width: 80 }}>z-score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stationEvents.map((ev) => (
                          <tr key={ev.id} style={{
                            borderLeft: `3px solid ${
                              ev.severity === 'critical' ? '#f5365c'
                              : ev.severity === 'error'  ? '#fd7e14'
                              : ev.severity === 'warning' ? '#fb6340'
                              : '#11cdef'
                            }`,
                          }}>
                            <td className="text-sm text-muted text-nowrap">
                              {fmtTs(ev.createdAt, true)}
                            </td>
                            <td>
                              <Badge color={SEVERITY_BADGE[ev.severity] || 'secondary'} className="text-capitalize">
                                {ev.severity}
                              </Badge>
                            </td>
                            <td className="text-sm">
                              {ev.sensor?.name
                                ? <>{ev.sensor.name} <small className="text-muted">({ev.sensor.unit})</small></>
                                : <span className="text-muted">—</span>}
                            </td>
                            <td className="text-sm" style={{ maxWidth: 320 }}>
                              <span title={ev.message} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {ev.message}
                              </span>
                            </td>
                            <td className="text-sm text-center">
                              {ev.zScore != null ? (
                                <span className="font-weight-bold" style={{
                                  color: Math.abs(ev.zScore) >= 3 ? '#f5365c' : Math.abs(ev.zScore) >= 2 ? '#fb6340' : '#8898aa',
                                }}>
                                  {Number(ev.zScore).toFixed(2)}σ
                                </span>
                              ) : <span className="text-muted">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
}
