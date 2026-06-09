import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Input,
  Row,
  Spinner,
  Table,
} from 'reactstrap';
import { analyticsService } from '../../../services/analyticsService';
import { alertService } from '../../../services/alertService';
import { stationService } from '../../../services/stationService';

const STATUS_COLORS = {
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
  offline: 'secondary',
};

const SEVERITY_COLORS = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
};

const ALERT_STATUS_COLORS = {
  active: 'danger',
  acknowledged: 'warning',
  resolved: 'success',
};

const SENSOR_LINE_COLORS = [
  '#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#ffd600',
];

const GRANULARITY_PRESETS = [
  { label: '24 h', hours: 24, granularity: 'hour' },
  { label: '7 d', hours: 168, granularity: 'hour' },
  { label: '30 d', hours: 720, granularity: 'day' },
];

function buildHistoryChart(history, selectedSensorId) {
  if (!history?.sensors?.length) return null;

  const sensors = selectedSensorId
    ? history.sensors.filter((s) => s.sensorId === selectedSensorId)
    : history.sensors.slice(0, 3);

  if (!sensors.length || !sensors[0].buckets?.length) return null;

  const labels = sensors[0].buckets.map((b) => {
    const d = new Date(b.time);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  });

  const datasets = sensors.map((s, i) => ({
    label: `${s.sensorName} avg (${s.unit})`,
    data: s.buckets.map((b) => b.avg),
    borderColor: SENSOR_LINE_COLORS[i % SENSOR_LINE_COLORS.length],
    backgroundColor: 'transparent',
    fill: false,
    pointRadius: s.buckets.length > 72 ? 0 : 3,
    borderWidth: 2,
  }));

  return { labels, datasets };
}

export default function StationDetailsPage() {
  const { stationId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [granularityIdx, setGranularityIdx] = useState(0);
  const [selectedSensorId, setSelectedSensorId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      stationService.getStation(stationId),
      alertService.getAlerts({ stationId, limit: 10 }),
    ])
      .then(([stationData, alertsData]) => {
        if (cancelled) return;
        setStation(stationData);
        setAlerts(alertsData.data || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Failed to load station details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [stationId]);

  useEffect(() => {
    const preset = GRANULARITY_PRESETS[granularityIdx];
    let cancelled = false;
    setHistoryLoading(true);

    const from = new Date(Date.now() - preset.hours * 3600 * 1000).toISOString();
    analyticsService
      .getStationHistory(stationId, { from, granularity: preset.granularity })
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
      })
      .catch(() => {
        if (cancelled) return;
        setHistory(null);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [stationId, granularityIdx]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner color="primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Container className="mt-5" fluid>
        <Alert color="danger">{error}</Alert>
        <Button color="secondary" onClick={() => navigate('/admin/stations')}>
          <i className="ni ni-bold-left mr-2" /> Back to Stations
        </Button>
      </Container>
    );
  }

  if (!station) return null;

  const sensors = station.sensors || [];
  const activeAlerts = alerts.filter((a) => a.status === 'active').length;
  const chartData = buildHistoryChart(history, selectedSensorId);

  return (
    <>
      {/* Page header */}
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <div className="header-body">
            <Row>
              <Col lg="3" md="6">
                <Card className="card-stats mb-4 mb-xl-0">
                  <CardBody>
                    <Row>
                      <div className="col">
                        <h5 className="card-title text-uppercase text-muted mb-0">Status</h5>
                        <span className="h2 font-weight-bold mb-0 text-capitalize">{station.status}</span>
                      </div>
                      <Col className="col-auto">
                        <div className={`icon icon-shape bg-${STATUS_COLORS[station.status] || 'secondary'} text-white rounded-circle shadow`}>
                          <i className="ni ni-building" />
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              </Col>

              <Col lg="3" md="6">
                <Card className="card-stats mb-4 mb-xl-0">
                  <CardBody>
                    <Row>
                      <div className="col">
                        <h5 className="card-title text-uppercase text-muted mb-0">Sensors</h5>
                        <span className="h2 font-weight-bold mb-0">{sensors.length}</span>
                      </div>
                      <Col className="col-auto">
                        <div className="icon icon-shape bg-primary text-white rounded-circle shadow">
                          <i className="ni ni-chart-bar-32" />
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              </Col>

              <Col lg="3" md="6">
                <Card className="card-stats mb-4 mb-xl-0">
                  <CardBody>
                    <Row>
                      <div className="col">
                        <h5 className="card-title text-uppercase text-muted mb-0">Active Alerts</h5>
                        <span className="h2 font-weight-bold mb-0">{activeAlerts}</span>
                      </div>
                      <Col className="col-auto">
                        <div className={`icon icon-shape bg-${activeAlerts > 0 ? 'danger' : 'success'} text-white rounded-circle shadow`}>
                          <i className="ni ni-bell-55" />
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              </Col>

              <Col lg="3" md="6">
                <Card className="card-stats mb-4 mb-xl-0">
                  <CardBody>
                    <Row>
                      <div className="col">
                        <h5 className="card-title text-uppercase text-muted mb-0">Capacity</h5>
                        <span className="h2 font-weight-bold mb-0">
                          {Number(station.capacity).toLocaleString()} {station.capacityUnit}
                        </span>
                      </div>
                      <Col className="col-auto">
                        <div className="icon icon-shape bg-yellow text-white rounded-circle shadow">
                          <i className="ni ni-archive-2" />
                        </div>
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          </div>
        </Container>
      </div>

      <Container className="mt--7" fluid>
        <Row className="mb-3">
          <Col>
            <Button color="secondary" size="sm" onClick={() => navigate('/admin/stations')}>
              <i className="ni ni-bold-left mr-2" /> Back to Stations
            </Button>
          </Col>
        </Row>

        <Row>
          {/* Station Metadata */}
          <Col lg="4" className="mb-4">
            <Card className="shadow h-100">
              <CardHeader className="border-0">
                <h3 className="mb-0">
                  {station.name}
                  <Badge color={STATUS_COLORS[station.status] || 'secondary'} className="ml-2 text-capitalize">
                    {station.status}
                  </Badge>
                </h3>
              </CardHeader>
              <CardBody>
                <dl className="row mb-0">
                  <dt className="col-sm-5 text-muted">Type</dt>
                  <dd className="col-sm-7 text-capitalize">{station.type}</dd>

                  <dt className="col-sm-5 text-muted">Location</dt>
                  <dd className="col-sm-7">{station.location || '—'}</dd>

                  <dt className="col-sm-5 text-muted">Latitude</dt>
                  <dd className="col-sm-7">{station.latitude != null ? station.latitude : '—'}</dd>

                  <dt className="col-sm-5 text-muted">Longitude</dt>
                  <dd className="col-sm-7">{station.longitude != null ? station.longitude : '—'}</dd>

                  <dt className="col-sm-5 text-muted">Capacity</dt>
                  <dd className="col-sm-7">
                    {Number(station.capacity).toLocaleString()} {station.capacityUnit}
                  </dd>

                  {station.description && (
                    <>
                      <dt className="col-sm-5 text-muted">Description</dt>
                      <dd className="col-sm-7">{station.description}</dd>
                    </>
                  )}

                  <dt className="col-sm-5 text-muted">Created</dt>
                  <dd className="col-sm-7">
                    {station.createdAt ? new Date(station.createdAt).toLocaleDateString() : '—'}
                  </dd>
                </dl>
              </CardBody>
            </Card>
          </Col>

          {/* Sensors list */}
          <Col lg="8" className="mb-4">
            <Card className="shadow">
              <CardHeader className="border-0">
                <h3 className="mb-0">Sensors ({sensors.length})</h3>
              </CardHeader>
              {sensors.length === 0 ? (
                <CardBody className="text-muted text-center py-5">No sensors attached to this station.</CardBody>
              ) : (
                <Table className="align-items-center table-flush" responsive>
                  <thead className="thead-light">
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensors.map((sensor) => (
                      <tr key={sensor.id}>
                        <td className="font-weight-bold">{sensor.name}</td>
                        <td className="text-capitalize">{sensor.type}</td>
                        <td>
                          {sensor.lastReading != null
                            ? `${Number(sensor.lastReading).toFixed(2)} ${sensor.unit || ''}`
                            : '—'}
                        </td>
                        <td>
                          <Badge color={STATUS_COLORS[sensor.status] || 'secondary'} className="text-capitalize">
                            {sensor.status}
                          </Badge>
                        </td>
                        <td className="text-sm text-muted">
                          {sensor.lastReadingAt
                            ? new Date(sensor.lastReadingAt).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </Col>
        </Row>

        {/* History Chart */}
        <Row>
          <Col className="mb-4">
            <Card className="shadow">
              <CardHeader className="border-0">
                <Row className="align-items-center">
                  <Col>
                    <h3 className="mb-0">Sensor History</h3>
                  </Col>
                  <Col xs="auto">
                    <div className="d-flex align-items-center" style={{ gap: 8 }}>
                      {sensors.length > 0 && (
                        <Input
                          type="select"
                          bsSize="sm"
                          style={{ width: 160 }}
                          value={selectedSensorId}
                          onChange={(e) => setSelectedSensorId(e.target.value)}
                        >
                          <option value="">All sensors</option>
                          {sensors.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </Input>
                      )}
                      <div className="btn-group btn-group-sm" role="group">
                        {GRANULARITY_PRESETS.map((p, i) => (
                          <Button
                            key={p.label}
                            color={granularityIdx === i ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setGranularityIdx(i)}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </Col>
                </Row>
              </CardHeader>
              <CardBody>
                {historyLoading ? (
                  <div className="text-center py-5"><Spinner color="primary" /></div>
                ) : chartData ? (
                  <div style={{ height: 280 }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        legend: { display: true, position: 'top' },
                        scales: {
                          xAxes: [{
                            ticks: {
                              maxTicksLimit: 8,
                              maxRotation: 0,
                              fontSize: 11,
                            },
                          }],
                          yAxes: [{ ticks: { fontSize: 11 } }],
                        },
                        tooltips: { mode: 'index', intersect: false },
                      }}
                    />
                  </div>
                ) : (
                  <p className="text-muted text-center py-4 mb-0">
                    No sensor data available for the selected period.
                  </p>
                )}
              </CardBody>
            </Card>
          </Col>
        </Row>

        {/* Recent Alerts */}
        <Row>
          <Col>
            <Card className="shadow">
              <CardHeader className="border-0">
                <h3 className="mb-0">Recent Alerts</h3>
              </CardHeader>
              {alerts.length === 0 ? (
                <CardBody className="text-muted text-center py-5">No alerts for this station.</CardBody>
              ) : (
                <Table className="align-items-center table-flush" responsive>
                  <thead className="thead-light">
                    <tr>
                      <th>Severity</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>
                          <Badge color={SEVERITY_COLORS[alert.severity] || 'secondary'} className="text-capitalize">
                            {alert.severity}
                          </Badge>
                        </td>
                        <td>{alert.message}</td>
                        <td>
                          <Badge color={ALERT_STATUS_COLORS[alert.status] || 'secondary'} className="text-capitalize">
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="text-sm text-muted">
                          {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}
