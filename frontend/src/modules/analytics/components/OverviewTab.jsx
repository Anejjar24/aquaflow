/**
 * OverviewTab — Tab 1: Real-time operational snapshot.
 *
 * Panels:
 *  • Stations by Status  (doughnut)
 *  • Active Alerts by Severity  (doughnut)
 *  • Station Health Grid  (one card per station)
 *  • 6-hour Network Activity  (line chart)
 *  • Recent Alert Feed  (sorted list, last 10)
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Badge, Button, Card, CardBody, CardHeader,
  Col, Progress, Row, Spinner,
} from 'reactstrap';

import {
  fetchStationStatus,
  fetchNetworkTrend,
  selectAnalyticsOverview,
  selectAnalyticsOverviewLoading,
  selectStationStatus,
  selectStationStatusLoading,
  selectNetworkTrend,
  selectNetworkTrendLoading,
} from '../../../store/slices/analyticsSlice';

import { fetchAlerts, selectAlerts, selectAlertsLoading } from '../../../store/slices/alertsSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  normal:   '#2dce89',
  warning:  '#fb6340',
  critical: '#f5365c',
  offline:  '#adb5bd',
};

const STATUS_BG = {
  normal:   'success',
  warning:  'warning',
  critical: 'danger',
  offline:  'secondary',
};

const SEVERITY_COLOR = {
  critical: '#f5365c',
  error:    '#fd7e14',
  warning:  '#fb6340',
  info:     '#11cdef',
};

const SEVERITY_BG = {
  critical: 'danger',
  error:    'warning',
  warning:  'warning',
  info:     'info',
};

const TYPE_LABEL = {
  threshold_violation: 'Threshold',
  anomaly:             'Anomaly',
  sensor_offline:      'Offline',
  maintenance_due:     'Maintenance',
  system_error:        'System',
  critical_event:      'Critical',
};

const STATION_TYPE_COLOR = {
  treatment:    'primary',
  distribution: 'info',
  storage:      'success',
  monitoring:   'warning',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function shortTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function healthPercent(station) {
  if (!station.totalSensors) return 0;
  return Math.round((station.activeSensors / station.totalSensors) * 100);
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildStatusDoughnut(stationsByStatus) {
  if (!stationsByStatus?.length) return null;
  const labels = stationsByStatus.map((s) => s.status);
  return {
    labels,
    datasets: [{
      data:            labels.map((l) => stationsByStatus.find((s) => s.status === l)?.count ?? 0),
      backgroundColor: labels.map((l) => STATUS_COLOR[l] || '#8898aa'),
      borderWidth: 0,
    }],
  };
}

function buildSeverityDoughnut(alertsBySeverity) {
  if (!alertsBySeverity?.length) return null;
  const labels = alertsBySeverity.map((a) => a.severity);
  return {
    labels,
    datasets: [{
      data:            labels.map((l) => alertsBySeverity.find((a) => a.severity === l)?.count ?? 0),
      backgroundColor: labels.map((l) => SEVERITY_COLOR[l] || '#8898aa'),
      borderWidth: 0,
    }],
  };
}

function buildTrendChart(trend) {
  if (!trend?.length) return null;
  const labels = trend.map((r) => shortTime(r.time));
  return {
    labels,
    datasets: [
      {
        label: 'Avg sensor reading',
        data:            trend.map((r) => r.avgValue),
        borderColor:     '#5e72e4',
        backgroundColor: 'rgba(94,114,228,0.10)',
        fill:        true,
        borderWidth: 2,
        pointRadius: trend.length > 12 ? 0 : 3,
        tension:     0.3,
      },
      {
        label: 'Measurement count',
        data:        trend.map((r) => r.readingCount),
        borderColor: '#2dce89',
        borderDash:  [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill:        false,
        yAxisID:     'count',
      },
    ],
  };
}

// ─── Chart options ────────────────────────────────────────────────────────────

const doughnutOpts = {
  maintainAspectRatio: false,
  cutoutPercentage:    68,
  legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
  tooltips: { callbacks: { label: (item, data) => ` ${data.labels[item.index]}: ${data.datasets[0].data[item.index]}` } },
};

const trendOpts = {
  maintainAspectRatio: false,
  legend: { display: true, position: 'top', labels: { boxWidth: 10, fontSize: 11 } },
  scales: {
    xAxes: [{ ticks: { maxTicksLimit: 8, autoSkip: true, maxRotation: 0 } }],
    yAxes: [
      { id: 'value', position: 'left',  ticks: { beginAtZero: false } },
      { id: 'count', position: 'right', ticks: { beginAtZero: true }, gridLines: { drawOnChartArea: false } },
    ],
  },
  tooltips: { mode: 'index', intersect: false },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-4 text-muted">
      <i className={`ni ${icon} mb-2`} style={{ fontSize: '1.6rem', display: 'block', opacity: 0.4 }} />
      <p className="mb-0 text-sm">{text}</p>
    </div>
  );
}

function StationCard({ station }) {
  const pct     = healthPercent(station);
  const barColor = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';
  const borderColor = STATUS_COLOR[station.status] || '#adb5bd';

  return (
    <Card
      className="shadow-sm mb-3"
      style={{ borderLeft: `4px solid ${borderColor}`, transition: 'box-shadow .2s' }}
    >
      <CardBody className="py-3 px-3">
        {/* Name + type */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 className="mb-0 font-weight-bold text-dark" style={{ fontSize: '0.85rem' }}>
              {station.name}
            </h6>
            {station.location && (
              <small className="text-muted">{station.location}</small>
            )}
          </div>
          <div className="d-flex align-items-center" style={{ gap: 4 }}>
            {station.type && (
              <Badge color={STATION_TYPE_COLOR[station.type] || 'secondary'} className="text-capitalize" style={{ fontSize: '0.65rem' }}>
                {station.type}
              </Badge>
            )}
            <Badge color={STATUS_BG[station.status] || 'secondary'} className="text-capitalize" style={{ fontSize: '0.65rem' }}>
              {station.status}
            </Badge>
          </div>
        </div>

        {/* Sensor health bar */}
        <div className="mb-1">
          <div className="d-flex justify-content-between mb-1">
            <small className="text-muted">Sensors active</small>
            <small className="font-weight-bold">
              {station.activeSensors}/{station.totalSensors}
            </small>
          </div>
          <Progress value={pct} color={barColor} style={{ height: 5 }} />
        </div>

        {/* Footer: alerts + last reading */}
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div>
            {station.openAlerts > 0 ? (
              <Badge color="danger" pill style={{ fontSize: '0.65rem' }}>
                <i className="ni ni-bell-55 mr-1" />
                {station.openAlerts} alert{station.openAlerts > 1 ? 's' : ''}
              </Badge>
            ) : (
              <small className="text-success">
                <i className="ni ni-check-bold mr-1" />No alerts
              </small>
            )}
          </div>
          {station.lastReadingAt && (
            <small className="text-muted">{relativeTime(station.lastReadingAt)}</small>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function AlertFeedRow({ alert }) {
  const sevColor = SEVERITY_BG[alert.severity] || 'secondary';
  const typeLabel = TYPE_LABEL[alert.type] || alert.type;

  return (
    <div className="d-flex align-items-start py-2 border-bottom">
      {/* Severity dot */}
      <div className="mr-3 mt-1">
        <span
          style={{
            display:         'inline-block',
            width:           10, height: 10,
            borderRadius:    '50%',
            backgroundColor: SEVERITY_COLOR[alert.severity] || '#adb5bd',
            flexShrink:      0,
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="d-flex align-items-center flex-wrap mb-1" style={{ gap: 4 }}>
          <Badge color={sevColor} className="text-capitalize" style={{ fontSize: '0.65rem' }}>
            {alert.severity}
          </Badge>
          <Badge color="light" className="text-dark border" style={{ fontSize: '0.65rem' }}>
            {typeLabel}
          </Badge>
          {alert.station?.name && (
            <span className="text-xs text-muted">{alert.station.name}</span>
          )}
        </div>
        <p className="mb-0 text-sm text-dark text-truncate" title={alert.message}>
          {alert.message}
        </p>
      </div>

      {/* Age */}
      <small className="text-muted ml-2 text-nowrap">{relativeTime(alert.createdAt)}</small>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OverviewTab() {
  const dispatch = useDispatch();

  // Selectors
  const overview          = useSelector(selectAnalyticsOverview);
  const overviewLoading   = useSelector(selectAnalyticsOverviewLoading);
  const stationStatus     = useSelector(selectStationStatus);
  const stationLoading    = useSelector(selectStationStatusLoading);
  const networkTrend      = useSelector(selectNetworkTrend);
  const trendLoading      = useSelector(selectNetworkTrendLoading);
  const recentAlerts      = useSelector(selectAlerts);
  const alertsLoading     = useSelector(selectAlertsLoading);

  // Refresh handler
  const refresh = () => {
    dispatch(fetchStationStatus());
    dispatch(fetchNetworkTrend(6));
    dispatch(fetchAlerts({ limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' }));
  };

  // Load alert feed on mount (stationStatus + trend already loaded by shell)
  useEffect(() => {
    dispatch(fetchAlerts({ limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' }));
  }, [dispatch]);

  // Chart data
  const statusChart   = buildStatusDoughnut(overview?.stationsByStatus);
  const severityChart = buildSeverityDoughnut(overview?.alertsBySeverity);
  const trendChart    = buildTrendChart(networkTrend);

  const recentFeed = (recentAlerts || []).slice(0, 10);

  return (
    <>
      {/* ── Row 1: Status doughnuts ──────────────────────────────────────── */}
      <Row className="mb-4">
        {/* Stations by Status */}
        <Col xl="6" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0 d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-0">Stations by Status</h3>
                <p className="text-muted text-sm mb-0">Current operational state of each monitoring station</p>
              </div>
              <Button color="link" size="sm" className="p-0 text-muted" onClick={refresh}>
                <i className="ni ni-refresh-02" />
              </Button>
            </CardHeader>
            <CardBody>
              {overviewLoading ? (
                <div className="text-center py-4"><Spinner color="primary" size="sm" /></div>
              ) : !statusChart ? (
                <EmptyState icon="ni-building" text="No station data available yet." />
              ) : (
                <>
                  <div style={{ height: 200 }}>
                    <Doughnut data={statusChart} options={doughnutOpts} />
                  </div>
                  <div className="d-flex flex-wrap justify-content-center mt-3" style={{ gap: '12px' }}>
                    {overview.stationsByStatus.map(({ status, count }) => (
                      <div key={status} className="text-center">
                        <div
                          className="text-capitalize font-weight-bold"
                          style={{ color: STATUS_COLOR[status] || '#8898aa', fontSize: '0.8rem' }}
                        >
                          {status}
                        </div>
                        <div className="h4 mb-0">{count}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </Col>

        {/* Active Alerts by Severity */}
        <Col xl="6" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0">
              <h3 className="mb-0">Active Alerts by Severity</h3>
              <p className="text-muted text-sm mb-0">Distribution of unresolved alerts across severity levels</p>
            </CardHeader>
            <CardBody>
              {overviewLoading ? (
                <div className="text-center py-4"><Spinner color="primary" size="sm" /></div>
              ) : !severityChart ? (
                <EmptyState icon="ni-bell-55" text="No active alerts — network is healthy." />
              ) : (
                <>
                  <div style={{ height: 200 }}>
                    <Doughnut data={severityChart} options={doughnutOpts} />
                  </div>
                  <div className="d-flex flex-wrap justify-content-center mt-3" style={{ gap: '12px' }}>
                    {overview.alertsBySeverity.map(({ severity, count }) => (
                      <div key={severity} className="text-center">
                        <div
                          className="text-capitalize font-weight-bold"
                          style={{ color: SEVERITY_COLOR[severity] || '#8898aa', fontSize: '0.8rem' }}
                        >
                          {severity}
                        </div>
                        <div className="h4 mb-0">{count}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* ── Row 2: Station Health Grid ───────────────────────────────────── */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow">
            <CardHeader className="border-0 d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-0">Station Health Overview</h3>
                <p className="text-muted text-sm mb-0">
                  Sensor availability, open alerts and last measurement for each station
                </p>
              </div>
              <Button color="link" size="sm" className="p-0 text-muted" onClick={refresh}>
                <i className="ni ni-refresh-02" />
              </Button>
            </CardHeader>
            <CardBody>
              {stationLoading && !stationStatus?.length ? (
                <div className="text-center py-4"><Spinner color="primary" size="sm" /></div>
              ) : !stationStatus?.length ? (
                <EmptyState icon="ni-building" text="No stations configured yet." />
              ) : (
                <Row>
                  {stationStatus.map((station) => (
                    <Col key={station.id} xl="3" lg="4" md="6" sm="12">
                      <StationCard station={station} />
                    </Col>
                  ))}
                </Row>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* ── Row 3: 6h Trend + Alert Feed ─────────────────────────────────── */}
      <Row>
        {/* 6-hour Network Activity */}
        <Col lg="7" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0 d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-0">6-Hour Network Activity</h3>
                <p className="text-muted text-sm mb-0">
                  Hourly average sensor readings and measurement volume across the entire network
                </p>
              </div>
              <Button
                color="link" size="sm" className="p-0 text-muted"
                onClick={() => dispatch(fetchNetworkTrend(6))}
              >
                <i className="ni ni-refresh-02" />
              </Button>
            </CardHeader>
            <CardBody>
              {trendLoading && !networkTrend?.length ? (
                <div className="text-center py-5"><Spinner color="primary" size="sm" /></div>
              ) : !trendChart ? (
                <EmptyState
                  icon="ni-chart-bar-32"
                  text="No measurements recorded in the last 6 hours. Data will appear once sensors begin reporting."
                />
              ) : (
                <div style={{ height: 280 }}>
                  <Line data={trendChart} options={trendOpts} />
                </div>
              )}
            </CardBody>
          </Card>
        </Col>

        {/* Recent Alert Feed */}
        <Col lg="5" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0 d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-0">Recent Events</h3>
                <p className="text-muted text-sm mb-0">Latest alerts across all stations</p>
              </div>
              <Button
                color="link" size="sm" className="p-0 text-muted"
                onClick={() => dispatch(fetchAlerts({ limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' }))}
              >
                <i className="ni ni-refresh-02" />
              </Button>
            </CardHeader>
            <CardBody className="py-0" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {alertsLoading && !recentFeed.length ? (
                <div className="text-center py-4"><Spinner color="primary" size="sm" /></div>
              ) : !recentFeed.length ? (
                <EmptyState icon="ni-check-bold" text="No recent alerts — all stations operating normally." />
              ) : (
                <div>
                  {recentFeed.map((alert) => (
                    <AlertFeedRow key={alert.id} alert={alert} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  );
}
