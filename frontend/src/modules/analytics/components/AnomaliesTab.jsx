/**
 * AnomaliesTab — Tab 2: Anomaly Detection & Patterns
 *
 * Panels:
 *  • Period selector + 3 summary stat cards
 *  • Anomaly frequency by station  (horizontal bar)
 *  • Anomaly distribution by type  (horizontal bar)
 *  • Chronological event timeline  (scrollable table)
 *  • Statistical anomaly detail    (z-score table from analysis engine — graceful empty)
 */
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bar, HorizontalBar } from 'react-chartjs-2';
import {
  Badge, Button, Card, CardBody, CardHeader,
  Col, Row, Spinner, Table,
} from 'reactstrap';

import {
  fetchAnomalyTimeline,
  fetchKpis,
  selectAnomalyTimeline,
  selectAnomalyLoading,
  selectAnomalyError,
  selectAnalyticsKpis,
  selectAnalyticsKpisLoading,
} from '../../../store/slices/analyticsSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '24 h', hours: 24  },
  { label: '7 d',  hours: 168 },
  { label: '30 d', hours: 720 },
];

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
  anomaly:             'Statistical Anomaly',
  threshold_violation: 'Threshold Exceeded',
  sensor_offline:      'Sensor Offline',
  critical_event:      'Critical Event',
  maintenance_due:     'Maintenance Due',
  system_error:        'System Error',
};
const TYPE_BADGE_COLOR = {
  anomaly:             'danger',
  threshold_violation: 'warning',
  sensor_offline:      'secondary',
  critical_event:      'danger',
  maintenance_due:     'info',
  system_error:        'dark',
};

const SEVERITY_WEIGHT = { critical: 4, error: 3, warning: 2, info: 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function round2(v) {
  if (v == null) return '—';
  return Number(v).toFixed(2);
}

function EmptyState({ icon = 'ni-bell-55', title, body }) {
  return (
    <div className="text-center py-5 text-muted">
      <i className={`ni ${icon} mb-3`} style={{ fontSize: '2rem', display: 'block', opacity: 0.35 }} />
      <h5 className="text-muted">{title}</h5>
      {body && <p className="mb-0 text-sm" style={{ maxWidth: 420, margin: '0 auto' }}>{body}</p>}
    </div>
  );
}

// ─── Derived data helpers ─────────────────────────────────────────────────────

function byStation(events) {
  const map = {};
  for (const e of events) {
    const name = e.station?.name || 'Unknown';
    map[name] = (map[name] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);           // top 10 stations
}

function byType(events) {
  const map = {};
  for (const e of events) {
    const label = TYPE_LABEL[e.type] || e.type;
    map[label] = (map[label] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function mostAffectedStation(events) {
  if (!events.length) return '—';
  const [name] = byStation(events)[0] || ['—'];
  return name;
}

function worstSeverityEvent(events) {
  if (!events.length) return null;
  return events.reduce((best, e) =>
    (SEVERITY_WEIGHT[e.severity] || 0) > (SEVERITY_WEIGHT[best?.severity] || 0) ? e : best, null);
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildFrequencyChart(events) {
  const stations = byStation(events);
  if (!stations.length) return null;
  return {
    labels: stations.map(([name]) => name),
    datasets: [{
      label: 'Events',
      data:             stations.map(([, count]) => count),
      backgroundColor: stations.map(([, , sev]) => 'rgba(245,54,92,0.75)'),
      borderColor:     'rgba(245,54,92,1)',
      borderWidth: 1,
      borderSkipped: false,
    }],
  };
}

function buildTypeChart(events) {
  const types = byType(events);
  if (!types.length) return null;
  const palette = ['#5e72e4', '#f5365c', '#fb6340', '#11cdef', '#2dce89', '#fd7e14'];
  return {
    labels: types.map(([label]) => label),
    datasets: [{
      label: 'Count',
      data:            types.map(([, count]) => count),
      backgroundColor: types.map((_, i) => palette[i % palette.length] + 'cc'),
      borderColor:     types.map((_, i) => palette[i % palette.length]),
      borderWidth: 1,
      borderSkipped: false,
    }],
  };
}

// ─── Chart options ────────────────────────────────────────────────────────────

const hBarOpts = {
  maintainAspectRatio: false,
  legend: { display: false },
  scales: {
    xAxes: [{ ticks: { beginAtZero: true, precision: 0 } }],
    yAxes: [{ ticks: { fontSize: 11 } }],
  },
  tooltips: {
    callbacks: {
      label: (item) => ` ${item.xLabel} event${item.xLabel !== 1 ? 's' : ''}`,
    },
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnomaliesTab() {
  const dispatch = useDispatch();
  const [periodHours, setPeriodHours] = useState(24);

  const events       = useSelector(selectAnomalyTimeline);
  const loading      = useSelector(selectAnomalyLoading);
  const error        = useSelector(selectAnomalyError);
  const kpis         = useSelector(selectAnalyticsKpis);
  const kpisLoading  = useSelector(selectAnalyticsKpisLoading);

  // Fetch on mount and when period changes
  useEffect(() => {
    dispatch(fetchAnomalyTimeline({ hours: periodHours, limit: 200 }));
    dispatch(fetchKpis({ granularity: 'hourly', hours: periodHours }));
  }, [dispatch, periodHours]);

  const refresh = () => {
    dispatch(fetchAnomalyTimeline({ hours: periodHours, limit: 200 }));
    dispatch(fetchKpis({ granularity: 'hourly', hours: periodHours }));
  };

  // Derived values (memoised)
  const freqChart   = useMemo(() => buildFrequencyChart(events), [events]);
  const typeChart   = useMemo(() => buildTypeChart(events),      [events]);
  const topStation  = useMemo(() => mostAffectedStation(events), [events]);
  const worstEvent  = useMemo(() => worstSeverityEvent(events),  [events]);

  const anomalyRows = useMemo(
    () => (kpis?.rows || []).filter((r) => r.anomalyFlag).slice(0, 50),
    [kpis],
  );

  const totalEvents = events.length;
  const criticalCnt = events.filter((e) => e.severity === 'critical' || e.severity === 'error').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Period selector + summary cards ────────────────────────────── */}
      <Row className="mb-4 align-items-center">
        <Col xs="auto">
          <div className="d-flex align-items-center" style={{ gap: 6 }}>
            <span className="text-sm text-muted mr-2">Period:</span>
            {PERIODS.map(({ label, hours }) => (
              <Button
                key={hours}
                size="sm"
                color={periodHours === hours ? 'primary' : 'secondary'}
                onClick={() => setPeriodHours(hours)}
              >
                {label}
              </Button>
            ))}
            <Button size="sm" color="link" className="text-muted p-0 ml-1" onClick={refresh}>
              <i className="ni ni-refresh-02" />
            </Button>
          </div>
        </Col>
      </Row>

      {/* Summary stat cards */}
      <Row className="mb-4">
        {[
          {
            label:  'Total events',
            value:  loading ? '…' : totalEvents,
            icon:   'ni-bell-55',
            color:  totalEvents > 0 ? 'danger' : 'success',
            sub:    `in the last ${periodHours < 48 ? `${periodHours}h` : `${periodHours / 24}d`}`,
          },
          {
            label:  'High-priority events',
            value:  loading ? '…' : criticalCnt,
            icon:   'ni-notification-70',
            color:  criticalCnt > 0 ? 'warning' : 'success',
            sub:    'critical or error severity',
          },
          {
            label:  'Most affected station',
            value:  loading ? '…' : topStation,
            icon:   'ni-building',
            color:  'primary',
            sub:    totalEvents > 0 ? 'highest event count' : 'no events recorded',
          },
          {
            label:  'Last event',
            value:  loading ? '…' : (worstEvent ? relativeTime(worstEvent.createdAt) : '—'),
            icon:   'ni-time-alarm',
            color:  worstEvent ? (SEVERITY_BG[worstEvent.severity] || 'secondary') : 'success',
            sub:    worstEvent ? `${worstEvent.station?.name || 'unknown station'}` : 'no recent events',
          },
        ].map(({ label, value, icon, color, sub }) => (
          <Col key={label} lg="3" md="6" className="mb-3">
            <Card className="shadow-sm h-100">
              <CardBody className="py-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div style={{ minWidth: 0 }}>
                    <p className="text-xs text-uppercase text-muted font-weight-bold mb-1">{label}</p>
                    <h3 className="mb-0 text-truncate" title={String(value)}>{value}</h3>
                    <small className="text-muted">{sub}</small>
                  </div>
                  <div className={`icon icon-shape bg-${color} text-white rounded-circle shadow ml-2`}
                    style={{ width: 40, height: 40, minWidth: 40, fontSize: '1rem' }}>
                    <i className={`ni ${icon}`} />
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>

      {error && (
        <div className="alert alert-warning mb-4">{error}</div>
      )}

      {/* ── Row 2: Frequency + Type breakdown ────────────────────────────── */}
      <Row className="mb-4">
        {/* Anomaly frequency by station */}
        <Col xl="6" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0">
              <h3 className="mb-0">Events by Station</h3>
              <p className="text-muted text-sm mb-0">Top 10 stations ranked by number of events in the selected period</p>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
              ) : !freqChart ? (
                <EmptyState
                  icon="ni-building"
                  title="No events detected"
                  body="No anomalies or threshold violations were recorded in the selected period. The network is operating normally."
                />
              ) : (
                <div style={{ height: Math.max(180, byStation(events).length * 36) }}>
                  <HorizontalBar data={freqChart} options={hBarOpts} />
                </div>
              )}
            </CardBody>
          </Card>
        </Col>

        {/* Anomaly distribution by type */}
        <Col xl="6" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0">
              <h3 className="mb-0">Events by Type</h3>
              <p className="text-muted text-sm mb-0">Breakdown of detected event categories in the selected period</p>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
              ) : !typeChart ? (
                <EmptyState
                  icon="ni-chart-bar-32"
                  title="No events detected"
                  body="Event type breakdown will appear once anomalies or alerts are recorded."
                />
              ) : (
                <div style={{ height: Math.max(180, byType(events).length * 36) }}>
                  <HorizontalBar data={typeChart} options={hBarOpts} />
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* ── Row 3: Chronological event timeline ──────────────────────────── */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow">
            <CardHeader className="border-0 d-flex justify-content-between align-items-center">
              <div>
                <h3 className="mb-0">Event Timeline</h3>
                <p className="text-muted text-sm mb-0">
                  All anomaly and threshold events in chronological order — newest first
                </p>
              </div>
              {totalEvents > 0 && (
                <Badge color="danger" pill className="ml-2">{totalEvents}</Badge>
              )}
            </CardHeader>
            <CardBody className="p-0">
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : !events.length ? (
                <EmptyState
                  icon="ni-check-bold"
                  title="No events in this period"
                  body="The network has been operating within normal parameters. No anomalies or threshold violations were detected."
                />
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <Table className="align-items-center table-flush mb-0" responsive>
                    <thead className="thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ width: 130 }}>Time</th>
                        <th style={{ width: 90 }}>Severity</th>
                        <th style={{ width: 160 }}>Type</th>
                        <th>Station</th>
                        <th>Sensor</th>
                        <th>Description</th>
                        <th style={{ width: 80 }}>z-score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr key={ev.id} style={{ borderLeft: `3px solid ${SEVERITY_COLOR[ev.severity] || '#dee2e6'}` }}>
                          <td className="text-sm text-nowrap text-muted">{fmtTs(ev.createdAt)}</td>
                          <td>
                            <Badge color={SEVERITY_BG[ev.severity] || 'secondary'} className="text-capitalize">
                              {ev.severity}
                            </Badge>
                          </td>
                          <td>
                            <Badge
                              color={TYPE_BADGE_COLOR[ev.type] || 'secondary'}
                              style={{ fontSize: '0.65rem', whiteSpace: 'normal', textAlign: 'left' }}
                            >
                              {TYPE_LABEL[ev.type] || ev.type}
                            </Badge>
                          </td>
                          <td className="text-sm font-weight-bold">
                            {ev.station?.name || <span className="text-muted">—</span>}
                          </td>
                          <td className="text-sm">
                            {ev.sensor?.name
                              ? <>{ev.sensor.name} <small className="text-muted">({ev.sensor.unit})</small></>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="text-sm" style={{ maxWidth: 280 }}>
                            <span title={ev.message} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {ev.message}
                            </span>
                          </td>
                          <td className="text-sm text-center">
                            {ev.zScore != null ? (
                              <span
                                className="font-weight-bold"
                                style={{ color: Math.abs(ev.zScore) >= 3 ? '#f5365c' : Math.abs(ev.zScore) >= 2 ? '#fb6340' : '#8898aa' }}
                              >
                                {Number(ev.zScore).toFixed(2)}σ
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* ── Row 4: Statistical detail from analysis engine ────────────────── */}
      <Row>
        <Col>
          <Card className="shadow">
            <CardHeader className="border-0">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h3 className="mb-0">Statistical Anomaly Detail</h3>
                  <p className="text-muted text-sm mb-0">
                    Deep-dive statistical context computed by the batch analysis engine — rolling mean, standard deviation and z-score per sensor
                  </p>
                </div>
                {kpis?.totalAnomalies > 0 && (
                  <Badge color="danger" pill>{kpis.totalAnomalies} flagged buckets</Badge>
                )}
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {kpisLoading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : !anomalyRows.length ? (
                /* Graceful empty state — Spark hasn't run yet */
                <div className="py-5 px-4 text-center text-muted">
                  <i className="ni ni-chart-pie-35 mb-3" style={{ fontSize: '2.2rem', display: 'block', opacity: 0.35 }} />
                  <h5 className="text-muted">Advanced statistical analysis not yet available</h5>
                  <p className="mb-0 text-sm" style={{ maxWidth: 480, margin: '0 auto' }}>
                    This section displays pre-computed rolling statistics (mean, standard deviation, z-score)
                    calculated by the batch analysis engine across all historical sensor data.
                    It will populate automatically once the first aggregation cycle completes.
                    Real-time event detection above is fully operational in the meantime.
                  </p>
                </div>
              ) : (
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  <Table className="align-items-center table-flush mb-0" responsive>
                    <thead className="thead-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th>Time bucket</th>
                        <th>Sensor ID</th>
                        <th className="text-right">Avg value</th>
                        <th className="text-right">Rolling mean</th>
                        <th className="text-right">Std dev (σ)</th>
                        <th className="text-right">Deviation</th>
                        <th className="text-center">Readings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalyRows.map((row, i) => {
                        const deviation = row.rollingMean != null && row.rollingStddev
                          ? ((row.avgValue - row.rollingMean) / row.rollingStddev).toFixed(2)
                          : null;
                        return (
                          <tr key={i} style={{ borderLeft: '3px solid #f5365c' }}>
                            <td className="text-sm text-nowrap text-muted">{fmtTs(row.bucket)}</td>
                            <td className="text-sm">
                              <code style={{ fontSize: '0.7rem' }}>{row.sensorId?.slice(0, 8)}…</code>
                            </td>
                            <td className="text-right text-sm font-weight-bold">{round2(row.avgValue)}</td>
                            <td className="text-right text-sm">{round2(row.rollingMean)}</td>
                            <td className="text-right text-sm">{round2(row.rollingStddev)}</td>
                            <td className="text-right">
                              {deviation != null ? (
                                <span
                                  className="font-weight-bold text-sm"
                                  style={{ color: Math.abs(deviation) >= 3 ? '#f5365c' : '#fb6340' }}
                                >
                                  {deviation > 0 ? '+' : ''}{deviation}σ
                                </span>
                              ) : '—'}
                            </td>
                            <td className="text-center text-sm">{row.readingCount ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  );
}
