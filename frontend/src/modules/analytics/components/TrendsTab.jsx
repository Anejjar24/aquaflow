/**
 * TrendsTab — Tab 3: Trends & History
 *
 * Panels:
 *  • Period selector + 3 summary stat cards
 *  • Network activity line chart  (avg value + reading volume over time)
 *  • Measurement volume by sensor (horizontal bar — top sensors)
 *  • Predictive outlook           (rule-based heuristic insight cards)
 *  • Anomaly frequency over time  (bar chart — events grouped by day/hour)
 */
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Bar, HorizontalBar, Line } from 'react-chartjs-2';
import {
  Badge, Button, Card, CardBody, CardHeader,
  Col, Progress, Row, Spinner,
} from 'reactstrap';

import {
  fetchNetworkTrend,
  fetchSystemMetrics,
  fetchAnomalyTimeline,
  selectNetworkTrend,
  selectNetworkTrendLoading,
  selectAnalyticsSystemMetrics,
  selectSystemMetricsLoading,
  selectAnomalyTimeline,
  selectDataFreshness,
} from '../../../store/slices/analyticsSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '24 h',  hours: 24  },
  { label: '7 d',   hours: 168 },
  { label: '30 d',  hours: 720 },
];

const SOURCE_BADGE = {
  aggregate:   { color: 'success',   text: 'High-resolution data' },
  raw:         { color: 'info',      text: 'Standard resolution'  },
  unavailable: { color: 'secondary', text: 'No data available'    },
};

const PALETTE = ['#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#fd7e14'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLabel(iso, hours) {
  if (!iso) return '';
  const d = new Date(iso);
  if (hours <= 48) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function round2(v) {
  if (v == null || isNaN(Number(v))) return null;
  return +Number(v).toFixed(2);
}

/** Sample an array down to ~maxPts evenly-spaced items so charts stay readable. */
function sample(arr, maxPts = 80) {
  if (!arr.length || arr.length <= maxPts) return arr;
  const step = arr.length / maxPts;
  return arr.filter((_, i) => Math.round(i % step) === 0);
}

/** Group events by calendar day (or hour when period ≤ 48h). */
function groupEventsByBucket(events, hours) {
  const map = {};
  for (const e of events) {
    const d   = new Date(e.createdAt);
    const key = hours <= 48
      ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`
      : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
}

// ─── Predictive heuristics ────────────────────────────────────────────────────

/**
 * Pure function — derives insight cards from available data.
 * No ML, no Spark required; uses anomaly timeline + network trend.
 */
function buildInsights({ events, networkTrend, systemMetrics, hours }) {
  const insights = [];

  // 1. Anomaly-rate assessment
  const totalMeasurements = systemMetrics?.totalReadings || 0;
  const anomalyCount      = events.length;
  const anomalyRate       = totalMeasurements > 0
    ? (anomalyCount / totalMeasurements) * 100
    : null;

  if (anomalyRate === null) {
    insights.push({
      icon:  'ni-chart-bar-32',
      color: 'secondary',
      title: 'Anomaly rate unavailable',
      body:  'Not enough measurement data to calculate an anomaly rate yet. Continue collecting sensor readings.',
    });
  } else if (anomalyRate === 0) {
    insights.push({
      icon:  'ni-check-bold',
      color: 'success',
      title: 'No anomalies detected',
      body:  `Zero anomalies found in the selected period (${totalMeasurements.toLocaleString()} measurements analysed). The network appears stable.`,
    });
  } else if (anomalyRate < 1) {
    insights.push({
      icon:  'ni-satisfied',
      color: 'info',
      title: 'Anomaly rate within normal range',
      body:  `${anomalyRate.toFixed(2)}% of measurements triggered an event — this is within acceptable limits for a network of this scale.`,
    });
  } else if (anomalyRate < 5) {
    insights.push({
      icon:  'ni-notification-70',
      color: 'warning',
      title: 'Moderate anomaly rate',
      body:  `${anomalyRate.toFixed(2)}% anomaly rate detected. Consider reviewing the most-affected stations and adjusting alert thresholds if needed.`,
    });
  } else {
    insights.push({
      icon:  'ni-bell-55',
      color: 'danger',
      title: 'Elevated anomaly rate — attention required',
      body:  `${anomalyRate.toFixed(2)}% of measurements triggered an event. Investigate the top affected stations and check sensor calibration.`,
    });
  }

  // 2. Trend direction
  if (networkTrend.length >= 4) {
    const firstHalf = networkTrend.slice(0, Math.floor(networkTrend.length / 3));
    const lastHalf  = networkTrend.slice(-Math.floor(networkTrend.length / 3));
    const avgFirst  = firstHalf.reduce((s, r) => s + (r.avgValue || 0), 0) / firstHalf.length;
    const avgLast   = lastHalf.reduce((s, r)  => s + (r.avgValue || 0), 0) / lastHalf.length;
    const delta     = avgLast - avgFirst;
    const pct       = avgFirst !== 0 ? ((delta / Math.abs(avgFirst)) * 100).toFixed(1) : null;

    if (Math.abs(delta) < 0.01) {
      insights.push({
        icon:  'ni-align-center',
        color: 'info',
        title: 'Network values stable',
        body:  `Average sensor readings have remained flat across the period — no significant upward or downward drift detected.`,
      });
    } else if (delta > 0) {
      insights.push({
        icon:  'ni-bold-up',
        color: 'warning',
        title: 'Network values trending upward',
        body:  `Average readings increased by ${pct !== null ? `${pct}%` : 'a notable amount'} over the period. Monitor sensors for threshold violations.`,
      });
    } else {
      insights.push({
        icon:  'ni-bold-down',
        color: 'info',
        title: 'Network values trending downward',
        body:  `Average readings decreased by ${pct !== null ? `${Math.abs(pct)}%` : 'a notable amount'} over the period. This may indicate reduced activity or sensor drift.`,
      });
    }
  }

  // 3. Volume / data-quality assessment
  if (systemMetrics) {
    const dailyRate = hours > 0 ? totalMeasurements / (hours / 24) : 0;
    if (totalMeasurements === 0) {
      insights.push({
        icon:  'ni-time-alarm',
        color: 'secondary',
        title: 'No measurements recorded',
        body:  'No sensor data was recorded in the selected period. Check that sensors are online and actively reporting.',
      });
    } else if (dailyRate > 10000) {
      insights.push({
        icon:  'ni-satisfied',
        color: 'success',
        title: 'High data collection rate',
        body:  `~${Math.round(dailyRate).toLocaleString()} measurements per day — the sensor network is reporting at a healthy rate.`,
      });
    } else {
      insights.push({
        icon:  'ni-time-alarm',
        color: 'warning',
        title: 'Low data collection rate',
        body:  `~${Math.round(dailyRate).toLocaleString()} measurements per day. Some sensors may be offline or reporting at reduced frequency.`,
      });
    }
  }

  // 4. Highest-severity recent event
  const critical = events.filter((e) => e.severity === 'critical' || e.severity === 'error');
  if (critical.length > 0) {
    const last = critical[0];
    insights.push({
      icon:  'ni-notification-70',
      color: 'danger',
      title: `${critical.length} high-priority event${critical.length > 1 ? 's' : ''} in period`,
      body:  `Most recent: "${last.message}" at ${last.station?.name || 'unknown station'}. Review the Anomaly Detection tab for details.`,
    });
  }

  return insights;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon = 'ni-chart-bar-32', title, body }) {
  return (
    <div className="text-center py-5 text-muted">
      <i className={`ni ${icon} mb-3`} style={{ fontSize: '2rem', display: 'block', opacity: 0.35 }} />
      <h5 className="text-muted">{title}</h5>
      {body && <p className="mb-0 text-sm" style={{ maxWidth: 420, margin: '0 auto' }}>{body}</p>}
    </div>
  );
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildTrendChart(rawRows, hours) {
  const rows = sample(rawRows, 90);
  if (!rows.length) return null;

  const labels      = rows.map((r) => fmtLabel(r.time, hours));
  const avgValues   = rows.map((r) => round2(r.avgValue));
  const readCounts  = rows.map((r) => r.readingCount ?? 0);

  return {
    labels,
    datasets: [
      {
        label: 'Average sensor value',
        data: avgValues,
        yAxisID: 'value',
        borderColor: '#5e72e4',
        backgroundColor: 'rgba(94,114,228,0.08)',
        fill: true,
        borderWidth: 2,
        pointRadius: rows.length > 40 ? 0 : 3,
        tension: 0.3,
      },
      {
        label: 'Readings per bucket',
        data: readCounts,
        yAxisID: 'count',
        borderColor: '#2dce89',
        backgroundColor: 'rgba(45,206,137,0.08)',
        fill: false,
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  };
}

function buildVolumeChart(topSensors) {
  if (!topSensors?.length) return null;
  const top = topSensors.slice(0, 12);
  return {
    labels: top.map((s) => `…${s.sensorId.slice(-8)}`),
    datasets: [{
      label: 'Measurements',
      data:            top.map((s) => s.totalReadings),
      backgroundColor: top.map((_, i) => PALETTE[i % PALETTE.length] + 'bb'),
      borderColor:     top.map((_, i) => PALETTE[i % PALETTE.length]),
      borderWidth: 1,
      borderSkipped: false,
    }],
  };
}

function buildEventFreqChart(events, hours) {
  const buckets = groupEventsByBucket(events, hours);
  if (!buckets.length) return null;
  return {
    labels: buckets.map(([k]) => k),
    datasets: [{
      label: 'Events',
      data:            buckets.map(([, v]) => v),
      backgroundColor: 'rgba(245,54,92,0.65)',
      borderColor:     'rgba(245,54,92,1)',
      borderWidth: 1,
    }],
  };
}

// ─── Chart options ────────────────────────────────────────────────────────────

function trendOpts(hasCount) {
  return {
    maintainAspectRatio: false,
    legend: { position: 'top', labels: { fontSize: 11 } },
    scales: {
      xAxes: [{
        ticks: {
          maxTicksLimit: 10,
          maxRotation: 40,
          fontSize: 10,
        },
      }],
      yAxes: [
        {
          id: 'value',
          position: 'left',
          scaleLabel: { display: true, labelString: 'Avg value', fontSize: 11 },
          ticks: { beginAtZero: false },
        },
        hasCount ? {
          id: 'count',
          position: 'right',
          scaleLabel: { display: true, labelString: 'Readings', fontSize: 11 },
          ticks: { beginAtZero: true },
          gridLines: { drawOnChartArea: false },
        } : null,
      ].filter(Boolean),
    },
    tooltips: {
      mode: 'index',
      intersect: false,
    },
  };
}

const hBarOpts = {
  maintainAspectRatio: false,
  legend: { display: false },
  scales: {
    xAxes: [{ ticks: { beginAtZero: true, precision: 0 } }],
    yAxes: [{ ticks: { fontSize: 10 } }],
  },
  tooltips: {
    callbacks: {
      label: (item) => ` ${Number(item.xLabel).toLocaleString()} readings`,
    },
  },
};

const barOpts = {
  maintainAspectRatio: false,
  legend: { display: false },
  scales: {
    xAxes: [{ ticks: { maxRotation: 45, fontSize: 10 } }],
    yAxes: [{ ticks: { beginAtZero: true, precision: 0 } }],
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrendsTab() {
  const dispatch = useDispatch();
  const [periodHours, setPeriodHours] = useState(24);

  const networkTrend       = useSelector(selectNetworkTrend);
  const trendLoading       = useSelector(selectNetworkTrendLoading);
  const systemMetrics      = useSelector(selectAnalyticsSystemMetrics);
  const metricsLoading     = useSelector(selectSystemMetricsLoading);
  const events             = useSelector(selectAnomalyTimeline);
  const freshness          = useSelector(selectDataFreshness);

  useEffect(() => {
    dispatch(fetchNetworkTrend(periodHours));
    dispatch(fetchSystemMetrics(periodHours));
    dispatch(fetchAnomalyTimeline({ hours: periodHours, limit: 500 }));
  }, [dispatch, periodHours]);

  const refresh = () => {
    dispatch(fetchNetworkTrend(periodHours));
    dispatch(fetchSystemMetrics(periodHours));
    dispatch(fetchAnomalyTimeline({ hours: periodHours, limit: 500 }));
  };

  // Derived / memoised
  const trendChart  = useMemo(() => buildTrendChart(networkTrend || [], periodHours), [networkTrend, periodHours]);
  const volumeChart = useMemo(() => buildVolumeChart(systemMetrics?.topSensors),      [systemMetrics]);
  const freqChart   = useMemo(() => buildEventFreqChart(events, periodHours),         [events, periodHours]);
  const insights    = useMemo(
    () => buildInsights({ events, networkTrend: networkTrend || [], systemMetrics, hours: periodHours }),
    [events, networkTrend, systemMetrics, periodHours],
  );

  const totalReadings  = systemMetrics?.totalReadings ?? 0;
  const avgNetworkVal  = useMemo(() => {
    if (!networkTrend?.length) return null;
    const vals = networkTrend.map((r) => r.avgValue).filter((v) => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : null;
  }, [networkTrend]);

  const sourceInfo  = SOURCE_BADGE[systemMetrics?.source] || SOURCE_BADGE.unavailable;
  const loading     = trendLoading || metricsLoading;
  const periodLabel = periodHours < 48 ? `${periodHours}h` : `${periodHours / 24}d`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card className="shadow mb-4">
        <CardBody className="py-3 px-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 16 }}>
              <span
                className="text-xs text-uppercase font-weight-bold text-muted"
                style={{ letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
              >
                <i className="ni ni-ui-04 mr-1" />
                Filters
              </span>
              <div style={{ borderLeft: '2px solid #e9ecef', height: 22, alignSelf: 'center' }} />
              <div className="d-flex align-items-center" style={{ gap: 6 }}>
                <span className="text-sm text-muted mr-1">Period</span>
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
            </div>
            <Badge color={sourceInfo.color} className="text-sm px-3 py-2">
              <i className="ni ni-cloud-upload-96 mr-1" />
              {sourceInfo.text}
            </Badge>
          </div>
        </CardBody>
      </Card>

      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      <Row className="mb-4">
        {[
          {
            label: 'Total measurements',
            value: loading ? '…' : totalReadings.toLocaleString(),
            icon:  'ni-chart-bar-32',
            color: totalReadings > 0 ? 'primary' : 'secondary',
            sub:   `in the last ${periodLabel}`,
          },
          {
            label: 'Avg network value',
            value: loading ? '…' : (avgNetworkVal ?? '—'),
            icon:  'ni-align-center',
            color: 'info',
            sub:   avgNetworkVal ? 'across all active sensors' : 'no trend data available',
          },
          {
            label: 'Events recorded',
            value: loading ? '…' : events.length,
            icon:  'ni-bell-55',
            color: events.length > 0 ? 'danger' : 'success',
            sub:   events.length === 0 ? 'no anomalies detected' : 'anomalies & threshold events',
          },
        ].map(({ label, value, icon, color, sub }) => (
          <Col key={label} lg="4" md="6" className="mb-3">
            <Card className="shadow-sm h-100">
              <CardBody className="py-3">
                <div className="d-flex justify-content-between align-items-start">
                  <div style={{ minWidth: 0 }}>
                    <p className="text-xs text-uppercase text-muted font-weight-bold mb-1">{label}</p>
                    <h3 className="mb-0 text-truncate">{value}</h3>
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

      {/* ── Network activity trend (line chart) ───────────────────────────── */}
      <Row className="mb-4">
        <Col>
          <Card className="shadow">
            <CardHeader className="border-0">
              <h3 className="mb-0">Network Activity — Last {periodLabel}</h3>
              <p className="text-muted text-sm mb-0">
                Hourly average sensor value and measurement volume across the entire network
              </p>
            </CardHeader>
            <CardBody>
              {trendLoading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : !trendChart ? (
                <EmptyState
                  icon="ni-chart-bar-32"
                  title="No trend data available"
                  body="Trend history will populate as sensors report readings over time. Ensure at least one sensor is actively collecting data."
                />
              ) : (
                <div style={{ height: 280 }}>
                  <Line data={trendChart} options={trendOpts(true)} />
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* ── Volume chart + Predictive outlook ─────────────────────────────── */}
      <Row className="mb-4">
        {/* Measurement volume by sensor */}
        <Col xl="5" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0">
              <h3 className="mb-0">Top Sensors by Volume</h3>
              <p className="text-muted text-sm mb-0">Sensors with the highest measurement count in the period</p>
            </CardHeader>
            <CardBody>
              {metricsLoading ? (
                <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
              ) : !volumeChart ? (
                <EmptyState
                  icon="ni-chart-pie-35"
                  title="No volume data"
                  body="Measurement volume per sensor will appear once sensors are actively reporting data."
                />
              ) : (
                <>
                  <div style={{ height: Math.max(200, (systemMetrics?.topSensors?.length || 1) * 30) }}>
                    <HorizontalBar data={volumeChart} options={hBarOpts} />
                  </div>
                  {systemMetrics?.source === 'raw' && (
                    <p className="text-xs text-muted mt-2 mb-0">
                      <i className="ni ni-info mr-1" />
                      Showing individual reading counts (hourly pre-aggregation not yet active).
                    </p>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </Col>

        {/* Predictive outlook */}
        <Col xl="7" className="mb-4">
          <Card className="shadow h-100">
            <CardHeader className="border-0">
              <h3 className="mb-0">Network Outlook</h3>
              <p className="text-muted text-sm mb-0">
                Automated analysis of current trends and operational risks for the selected period
              </p>
            </CardHeader>
            <CardBody>
              {loading && !insights.length ? (
                <div className="text-center py-4"><Spinner size="sm" color="primary" /></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {insights.map((ins, i) => (
                    <div
                      key={i}
                      className={`border-left border-${ins.color}`}
                      style={{ borderLeftWidth: 4, paddingLeft: 14 }}
                    >
                      <div className="d-flex align-items-start">
                        <div
                          className={`icon icon-shape bg-${ins.color} text-white rounded-circle shadow mr-3`}
                          style={{ width: 34, height: 34, minWidth: 34, fontSize: '0.85rem', flexShrink: 0 }}
                        >
                          <i className={`ni ${ins.icon}`} />
                        </div>
                        <div>
                          <h5 className={`mb-1 text-${ins.color === 'secondary' ? 'muted' : ins.color}`}>
                            {ins.title}
                          </h5>
                          <p className="text-sm text-muted mb-0">{ins.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted mt-4 mb-0" style={{ borderTop: '1px solid #e9ecef', paddingTop: 10 }}>
                <i className="ni ni-bulb-61 mr-1" />
                Outlook is generated from network activity patterns and event history — no external model required.
              </p>
            </CardBody>
          </Card>
        </Col>
      </Row>

      {/* ── Anomaly frequency over time ────────────────────────────────────── */}
      <Row>
        <Col>
          <Card className="shadow">
            <CardHeader className="border-0">
              <h3 className="mb-0">Event Frequency Over Time</h3>
              <p className="text-muted text-sm mb-0">
                {periodHours <= 48
                  ? 'Number of anomaly and threshold events per hour'
                  : 'Number of anomaly and threshold events per day'}
                {' '}over the last {periodLabel}
              </p>
            </CardHeader>
            <CardBody>
              {!freqChart ? (
                <EmptyState
                  icon="ni-check-bold"
                  title="No events in this period"
                  body="Event frequency will appear here once anomalies or threshold violations are recorded. The network is operating cleanly."
                />
              ) : (
                <div style={{ height: 220 }}>
                  <Bar data={freqChart} options={barOpts} />
                </div>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </>
  );
}
