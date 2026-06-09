import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  Col,
  Container,
  Nav,
  NavItem,
  NavLink,
  Row,
  Spinner,
  TabContent,
  TabPane,
} from 'reactstrap';

import {
  fetchAnalyticsOverview,
  fetchAnalyticsSensors,
  fetchStationStatus,
  fetchNetworkTrend,
  fetchDataFreshness,
  fetchAnomalyTimeline,
  fetchKpis,
  fetchSystemMetrics,
  selectAnalyticsOverview,
  selectAnalyticsOverviewLoading,
  selectAnalyticsOverviewError,
  selectDataFreshness,
} from '../../../store/slices/analyticsSlice';

import OverviewTab      from '../components/OverviewTab';
import AnomaliesTab     from '../components/AnomaliesTab';
import TrendsTab        from '../components/TrendsTab';
import StationDetailTab from '../components/StationDetailTab';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',       label: 'Overview',          icon: 'ni-chart-bar-32'  },
  { id: 'anomalies',      label: 'Anomaly Detection', icon: 'ni-bell-55'       },
  { id: 'trends',         label: 'Trends & History',  icon: 'ni-chart-pie-35'  },
  { id: 'station-detail', label: 'Station Detail',    icon: 'ni-building'      },
];

// ─── Helper: monitoring status dot ───────────────────────────────────────────

function MonitoringDot({ active }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10, height: 10,
        borderRadius: '50%',
        backgroundColor: active ? '#2dce89' : '#adb5bd',
        marginRight: 6,
        animation: active ? 'pulse 2s infinite' : 'none',
      }}
    />
  );
}

// ─── Helper: relative time ────────────────────────────────────────────────────

function relativeTime(isoString) {
  if (!isoString) return null;
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('overview');

  const overview       = useSelector(selectAnalyticsOverview);
  const overviewLoading = useSelector(selectAnalyticsOverviewLoading);
  const overviewError   = useSelector(selectAnalyticsOverviewError);
  const freshness      = useSelector(selectDataFreshness);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAnalyticsOverview());
    dispatch(fetchAnalyticsSensors());
    dispatch(fetchDataFreshness());
    // Pre-fetch Tab 1 data so it loads instantly when user arrives
    dispatch(fetchStationStatus());
    dispatch(fetchNetworkTrend(6));
    dispatch(fetchAnomalyTimeline({ hours: 24, limit: 100 }));
  }, [dispatch]);

  // ── Tab-switch data loading (lazy per tab) ─────────────────────────────────
  const handleTabSwitch = useCallback((tabId) => {
    setActiveTab(tabId);
    if (tabId === 'anomalies') {
      dispatch(fetchAnomalyTimeline({ hours: 24, limit: 100 }));
      dispatch(fetchKpis({ granularity: 'hourly', hours: 24 }));
    }
    if (tabId === 'trends') {
      dispatch(fetchSystemMetrics(24));
    }
  }, [dispatch]);

  // ── Anomaly count badge on the Anomalies tab ───────────────────────────────
  const openAlerts = overview?.openAlerts ?? 0;

  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <div className="header-body">

            {/* Monitoring status banner */}
            <Row className="mb-3 align-items-center">
              <Col>
                <h2 className="text-white mb-0">
                  <MonitoringDot active={freshness?.monitoringActive} />
                  Network Analytics
                </h2>
                <p className="text-white-50 mb-0" style={{ fontSize: '0.85rem' }}>
                  {freshness?.lastReadingAt
                    ? <>Last measurement: <strong>{relativeTime(freshness.lastReadingAt)}</strong></>
                    : 'Waiting for sensor data…'}
                  {freshness?.totalMeasurements > 0 && (
                    <> &nbsp;·&nbsp; {Number(freshness.totalMeasurements).toLocaleString()} measurements recorded</>
                  )}
                </p>
              </Col>
            </Row>

            {/* Overview KPI cards */}
            {overviewLoading ? (
              <div className="text-center py-3"><Spinner color="light" size="sm" /></div>
            ) : overviewError ? (
              <Alert color="warning" className="mb-0">{overviewError}</Alert>
            ) : overview ? (
              <Row>
                {[
                  { label: 'Monitoring Stations', value: overview.totalStations,     icon: 'ni-building',     bg: 'primary' },
                  { label: 'Active Sensors',       value: overview.activeSensors,     icon: 'ni-chart-bar-32', bg: 'success' },
                  { label: 'Open Alerts',          value: overview.openAlerts,        icon: 'ni-bell-55',      bg: overview.openAlerts > 0 ? 'danger' : 'success' },
                  { label: 'Scheduled Maintenance',value: overview.maintenancePending,icon: 'ni-settings',     bg: 'warning' },
                ].map(({ label, value, icon, bg }) => (
                  <Col lg="3" md="6" key={label}>
                    <Card className="card-stats mb-4 mb-xl-0">
                      <CardBody>
                        <Row>
                          <div className="col">
                            <h5 className="card-title text-uppercase text-muted mb-0">{label}</h5>
                            <span className="h2 font-weight-bold mb-0">{value ?? '—'}</span>
                          </div>
                          <Col className="col-auto">
                            <div className={`icon icon-shape bg-${bg} text-white rounded-circle shadow`}>
                              <i className={`ni ${icon}`} />
                            </div>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : null}

          </div>
        </Container>
      </div>

      {/* ── Tab navigation + content ─────────────────────────────────────── */}
      <Container className="mt--7" fluid>

        {/* Tab bar */}
        <Card className="shadow mb-0">
          <CardBody className="py-0 px-0">
            <Nav tabs className="nav-fill flex-column flex-sm-row border-0">
              {TABS.map(({ id, label, icon }) => (
                <NavItem key={id}>
                  <NavLink
                    className={`py-3 font-weight-600 ${activeTab === id ? 'active' : ''}`}
                    style={{ cursor: 'pointer', border: 'none', borderBottom: activeTab === id ? '3px solid #5e72e4' : '3px solid transparent' }}
                    onClick={() => handleTabSwitch(id)}
                  >
                    <i className={`ni ${icon} mr-2`} />
                    {label}
                    {id === 'anomalies' && openAlerts > 0 && (
                      <Badge color="danger" className="ml-2" pill>{openAlerts}</Badge>
                    )}
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
          </CardBody>
        </Card>

        {/* Tab content */}
        <TabContent activeTab={activeTab} className="mt-4">
          <TabPane tabId="overview">
            <OverviewTab />
          </TabPane>

          <TabPane tabId="anomalies">
            <AnomaliesTab />
          </TabPane>

          <TabPane tabId="trends">
            <TrendsTab />
          </TabPane>

          <TabPane tabId="station-detail">
            <StationDetailTab />
          </TabPane>
        </TabContent>

      </Container>

      {/* Pulse animation for monitoring dot */}
      <style>{`
        @keyframes pulse {
          0%   { box-shadow: 0 0 0 0 rgba(45,206,137,0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(45,206,137,0); }
          100% { box-shadow: 0 0 0 0 rgba(45,206,137,0); }
        }
      `}</style>
    </>
  );
}
