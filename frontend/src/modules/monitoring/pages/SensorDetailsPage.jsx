import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Line } from 'react-chartjs-2';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Row,
  Spinner,
} from 'reactstrap';
import useSocket from '../../../hooks/useSocket';
import { selectRealtimeConnected } from '../../../store/slices/realtimeSlice';
import sensorService from '../../../services/sensorService';

const STATUS_COLORS = {
  active: 'success',
  inactive: 'secondary',
  faulty: 'danger',
  offline: 'dark',
};

const LIMIT_OPTIONS = [50, 100, 200, 500];

function buildChartData(readings, sensor) {
  // Readings come back newest-first — reverse so time goes left to right
  const ordered = [...readings].reverse();

  const labels = ordered.map((r) => {
    const d = new Date(r.timestamp);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  });

  const values = ordered.map((r) => Number(r.value));

  const datasets = [
    {
      label: `${sensor.name} (${sensor.unit})`,
      data: values,
      borderColor: '#5e72e4',
      backgroundColor: 'rgba(94,114,228,0.08)',
      fill: true,
      pointRadius: readings.length > 100 ? 0 : 3,
      pointHoverRadius: 4,
      borderWidth: 2,
    },
  ];

  if (sensor.minThreshold != null) {
    datasets.push({
      label: `Min threshold (${sensor.minThreshold} ${sensor.unit})`,
      data: values.map(() => Number(sensor.minThreshold)),
      borderColor: '#2dce89',
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }

  if (sensor.maxThreshold != null) {
    datasets.push({
      label: `Max threshold (${sensor.maxThreshold} ${sensor.unit})`,
      data: values.map(() => Number(sensor.maxThreshold)),
      borderColor: '#f5365c',
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }

  return { labels, datasets };
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  legend: {
    display: true,
    position: 'bottom',
    labels: { usePointStyle: true, padding: 16, fontSize: 12 },
  },
  scales: {
    xAxes: [
      {
        ticks: { maxTicksLimit: 10, autoSkip: true, fontSize: 11 },
        gridLines: { display: false },
      },
    ],
    yAxes: [
      {
        ticks: { fontSize: 11, padding: 8 },
        gridLines: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
      },
    ],
  },
  tooltips: {
    mode: 'index',
    intersect: false,
    callbacks: {
      label: (item, data) => {
        const ds = data.datasets[item.datasetIndex];
        return ` ${ds.label}: ${item.yLabel}`;
      },
    },
  },
  elements: {
    line: { tension: 0.3 },
  },
};

// ─── Live Feed helpers ────────────────────────────────────────────────────────

const LIVE_BUFFER_SIZE = 50;

function buildLiveChartData(liveReadings, sensor) {
  // liveReadings is newest-first — reverse so time flows left → right
  const ordered = [...liveReadings].reverse();
  return {
    labels: ordered.map((r) => {
      const d = new Date(r.timestamp);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }),
    datasets: [
      {
        label: `${sensor?.name ?? 'Sensor'} (${sensor?.unit ?? ''})`,
        data: ordered.map((r) => Number(r.value)),
        borderColor: '#2dce89',
        backgroundColor: 'rgba(45,206,137,0.08)',
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };
}

const liveChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  legend: { display: false },
  scales: {
    xAxes: [{ ticks: { maxTicksLimit: 8, autoSkip: true, fontSize: 10 }, gridLines: { display: false } }],
    yAxes: [{ ticks: { fontSize: 11, padding: 8 }, gridLines: { color: 'rgba(0,0,0,0.05)', drawBorder: false } }],
  },
  tooltips: { mode: 'index', intersect: false },
  elements: { line: { tension: 0.3 } },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function SensorDetailsPage() {
  const { sensorId } = useParams();
  const navigate = useNavigate();

  const [sensor, setSensor] = useState(null);
  const [readings, setReadings] = useState([]);
  const [limit, setLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // ── Live feed ──────────────────────────────────────────────────────────────
  const [liveReadings, setLiveReadings] = useState([]); // newest-first, max 50
  const isConnected = useSelector(selectRealtimeConnected);
  const lastSensorUpdate = useSelector((state) => state.realtime.lastSensorUpdate);
  useSocket(true); // establish WebSocket on this page

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [sensorData, historyData] = await Promise.all([
          sensorService.getSensorById(sensorId),
          sensorService.getSensorData(sensorId, limit),
        ]);
        if (!cancelled) {
          setSensor(sensorData);
          setReadings(Array.isArray(historyData) ? historyData : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load sensor data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [sensorId, limit]);

  // Pre-seed live buffer whenever historical data loads / limit changes
  useEffect(() => {
    if (readings.length > 0) {
      setLiveReadings(readings.slice(0, LIVE_BUFFER_SIZE));
    }
  }, [readings]);

  // Append incoming WebSocket readings for this sensor
  useEffect(() => {
    if (!lastSensorUpdate || lastSensorUpdate.sensorId !== sensorId) return;
    const point = {
      value: lastSensorUpdate.value,
      timestamp: lastSensorUpdate.timestamp ?? new Date().toISOString(),
    };
    setLiveReadings((prev) => [point, ...prev].slice(0, LIVE_BUFFER_SIZE));
  }, [lastSensorUpdate, sensorId]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await sensorService.exportSensorDataCsv(sensorId, { limit });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sensor-${sensorId}-data.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
        <Spinner color="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Container className="mt-5" fluid>
        <p className="text-danger">{error}</p>
        <Button color="secondary" size="sm" onClick={() => navigate(-1)}>Back</Button>
      </Container>
    );
  }

  const chartData = sensor && readings.length > 0 ? buildChartData(readings, sensor) : null;

  const latestReading = readings[0];
  const avg = readings.length
    ? (readings.reduce((sum, r) => sum + Number(r.value), 0) / readings.length).toFixed(2)
    : null;
  const min = readings.length
    ? Math.min(...readings.map((r) => Number(r.value))).toFixed(2)
    : null;
  const max = readings.length
    ? Math.max(...readings.map((r) => Number(r.value))).toFixed(2)
    : null;

  return (
    <>
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <Row className="align-items-center">
            <Col>
              <Button
                color="default"
                size="sm"
                className="mb-3"
                onClick={() => navigate('/admin/monitoring')}
              >
                <i className="ni ni-bold-left mr-1" /> Back to Monitoring
              </Button>
              <h1 className="text-white mb-0">{sensor?.name}</h1>
              <p className="text-white-50 mb-0">
                {sensor?.station?.name} &mdash; {sensor?.type} &mdash;{' '}
                <Badge color={STATUS_COLORS[sensor?.status] || 'secondary'} className="ml-1">
                  {sensor?.status}
                </Badge>
              </p>
            </Col>
          </Row>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        {/* KPI row */}
        <Row className="mb-4">
          {[
            {
              label: 'Current Reading',
              value: latestReading
                ? `${Number(latestReading.value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${sensor.unit}`
                : '—',
              icon: 'ni ni-chart-bar-32',
              color: 'primary',
            },
            {
              label: 'Average',
              value: avg !== null ? `${avg} ${sensor.unit}` : '—',
              icon: 'ni ni-chart-pie-35',
              color: 'info',
            },
            {
              label: 'Min Threshold',
              value: sensor.minThreshold != null ? `${sensor.minThreshold} ${sensor.unit}` : 'None',
              icon: 'ni ni-bold-down',
              color: 'success',
            },
            {
              label: 'Max Threshold',
              value: sensor.maxThreshold != null ? `${sensor.maxThreshold} ${sensor.unit}` : 'None',
              icon: 'ni ni-bold-up',
              color: 'danger',
            },
          ].map(({ label, value, icon, color }) => (
            <Col key={label} lg="3" md="6" className="mb-4">
              <Card className="card-stats shadow">
                <CardBody>
                  <Row>
                    <div className="col">
                      <h5 className="card-title text-uppercase text-muted mb-0">{label}</h5>
                      <span className="h4 font-weight-bold mb-0">{value}</span>
                    </div>
                    <Col className="col-auto">
                      <div className={`icon icon-shape bg-${color} text-white rounded-circle shadow`}>
                        <i className={icon} />
                      </div>
                    </Col>
                  </Row>
                </CardBody>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Live Feed card ───────────────────────────────────────────── */}
        <Card className="shadow mb-4">
          <CardHeader className="border-0">
            <Row className="align-items-center">
              <Col>
                <h3 className="mb-0">
                  Live Feed{' '}
                  {isConnected ? (
                    <Badge color="success" style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}>
                      ● Live
                    </Badge>
                  ) : (
                    <Badge color="secondary" style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}>
                      ○ Disconnected
                    </Badge>
                  )}
                </h3>
                <p className="text-muted text-sm mb-0">
                  Rolling buffer — last {liveReadings.length} reading{liveReadings.length !== 1 ? 's' : ''}
                </p>
              </Col>
              {liveReadings.length > 0 && sensor && (
                <Col xs="auto">
                  <span className="h3 font-weight-bold text-success mb-0">
                    {Number(liveReadings[0].value).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    <small className="text-muted font-weight-normal">{sensor.unit}</small>
                  </span>
                </Col>
              )}
            </Row>
          </CardHeader>
          <CardBody className="pt-0 pb-3">
            {liveReadings.length > 0 && sensor ? (
              <div style={{ height: 220 }}>
                <Line data={buildLiveChartData(liveReadings, sensor)} options={liveChartOptions} />
              </div>
            ) : (
              <p className="text-muted text-center py-4 mb-0">
                {isConnected
                  ? 'Waiting for live sensor data…'
                  : 'Not connected — live updates paused.'}
              </p>
            )}
          </CardBody>
        </Card>

        {/* Chart card */}
        <Card className="shadow mb-4">
          <CardHeader className="border-0">
            <Row className="align-items-center">
              <Col>
                <h3 className="mb-0">Historical Readings</h3>
                {readings.length > 0 && (
                  <p className="text-muted text-sm mb-0">
                    {readings.length} data point{readings.length !== 1 ? 's' : ''} &mdash;
                    range: {min} – {max} {sensor.unit}
                  </p>
                )}
              </Col>
              <Col xs="auto">
                <div className="d-flex align-items-center">
                  <small className="text-muted mr-2">Show last</small>
                  {LIMIT_OPTIONS.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      color={limit === n ? 'primary' : 'secondary'}
                      className="ml-1"
                      onClick={() => setLimit(n)}
                    >
                      {n}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    color="default"
                    className="ml-3"
                    disabled={isExporting || readings.length === 0}
                    onClick={handleExport}
                  >
                    <i className="ni ni-cloud-download-95 mr-1" />
                    {isExporting ? 'Exporting…' : 'Export CSV'}
                  </Button>
                </div>
              </Col>
            </Row>
          </CardHeader>
          <CardBody>
            {chartData ? (
              <div style={{ height: 380 }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <p className="text-muted text-center py-5">
                No historical readings available for this sensor.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Sensor metadata */}
        <Card className="shadow mb-4">
          <CardHeader className="border-0">
            <h3 className="mb-0">Sensor Details</h3>
          </CardHeader>
          <CardBody>
            <Row>
              {[
                ['Device ID', sensor.deviceId || '—'],
                ['Serial Number', sensor.serialNumber || '—'],
                ['Location', sensor.location || '—'],
                ['Alert Enabled', sensor.alertEnabled ? 'Yes' : 'No'],
                ['Last Reading', latestReading ? new Date(latestReading.timestamp).toLocaleString() : '—'],
                ['Station', sensor.station?.name || '—'],
              ].map(([k, v]) => (
                <Col key={k} md="4" className="mb-3">
                  <small className="text-muted d-block">{k}</small>
                  <span className="font-weight-bold">{v}</span>
                </Col>
              ))}
            </Row>
          </CardBody>
        </Card>
      </Container>
    </>
  );
}
