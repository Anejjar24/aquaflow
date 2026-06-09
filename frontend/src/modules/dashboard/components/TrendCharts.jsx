import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Col,
  Input,
  Row,
  Spinner,
} from 'reactstrap';
import { analyticsService } from '../../../services/analyticsService';

// ─── Constants ───────────────────────────────────────────────────────────────

const SENSOR_LINE_COLORS = [
  '#5e72e4', '#2dce89', '#fb6340', '#11cdef', '#f5365c', '#ffd600',
];

const GRANULARITY_PRESETS = [
  { label: '24 h', hours: 24, granularity: 'hour' },
  { label: '7 d',  hours: 168, granularity: 'hour' },
  { label: '30 d', hours: 720, granularity: 'day' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChartData(history) {
  if (!history?.sensors?.length) return null;

  // Show up to 4 sensors to keep the dashboard readable
  const sensors = history.sensors.slice(0, 4);
  if (!sensors[0]?.buckets?.length) return null;

  const labels = sensors[0].buckets.map((b) => {
    const d = new Date(b.time);
    // Compact label for dashboard: "Jan 15 14:00" or "Jan 15" for daily
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: sensors.length && history.period?.granularity !== 'day' ? '2-digit' : undefined,
      minute: history.period?.granularity !== 'day' ? '2-digit' : undefined,
    });
  });

  const datasets = sensors.map((s, i) => ({
    label: `${s.sensorName} (${s.unit})`,
    data: s.buckets.map((b) => b.avg),
    borderColor: SENSOR_LINE_COLORS[i % SENSOR_LINE_COLORS.length],
    backgroundColor: 'transparent',
    fill: false,
    // Skip point rendering when there are many data points (clutters the chart)
    pointRadius: s.buckets.length > 48 ? 0 : 3,
    borderWidth: 2,
  }));

  return { labels, datasets };
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * TrendCharts — dashboard widget that renders a multi-sensor history chart.
 *
 * Props:
 *   stations  {Array}  — list of stations from stationsSlice (already fetched by DashboardPage)
 */
export default function TrendCharts({ stations = [] }) {
  const [selectedStationId, setSelectedStationId] = useState('');
  const [granularityIdx, setGranularityIdx] = useState(0);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Auto-select first station once the list is available
  useEffect(() => {
    if (stations.length > 0 && !selectedStationId) {
      setSelectedStationId(stations[0].id);
    }
  }, [stations, selectedStationId]);

  // Fetch history whenever station or granularity changes
  useEffect(() => {
    if (!selectedStationId) return;

    let cancelled = false;
    const preset = GRANULARITY_PRESETS[granularityIdx];
    const from = new Date(Date.now() - preset.hours * 3600 * 1000).toISOString();

    setLoading(true);
    setFetchError(null);

    analyticsService
      .getStationHistory(selectedStationId, { from, granularity: preset.granularity })
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setFetchError('Failed to load sensor history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedStationId, granularityIdx]);

  const chartData = history ? buildChartData(history) : null;
  const selectedStation = stations.find((s) => s.id === selectedStationId);

  return (
    <Card className="shadow">
      <CardHeader className="border-0">
        <Row className="align-items-center">
          <Col>
            <h3 className="mb-0">
              Sensor Trends
              {selectedStation && (
                <Badge color="info" className="ml-2 font-weight-normal" style={{ fontSize: '0.7rem' }}>
                  {selectedStation.name}
                </Badge>
              )}
            </h3>
          </Col>
          <Col xs="auto">
            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              {/* Station selector */}
              {stations.length > 0 && (
                <Input
                  type="select"
                  bsSize="sm"
                  style={{ width: 160 }}
                  value={selectedStationId}
                  onChange={(e) => {
                    setSelectedStationId(e.target.value);
                    setHistory(null);
                  }}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Input>
              )}
              {/* Granularity toggle */}
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
        {stations.length === 0 ? (
          <p className="text-muted text-center py-4 mb-0">
            No stations available.
          </p>
        ) : loading ? (
          <div className="text-center py-5">
            <Spinner color="primary" />
          </div>
        ) : fetchError ? (
          <p className="text-danger text-center py-4 mb-0">{fetchError}</p>
        ) : chartData ? (
          <div style={{ height: 260 }}>
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                  display: true,
                  position: 'top',
                  labels: { fontSize: 11, boxWidth: 12 },
                },
                scales: {
                  xAxes: [{
                    ticks: {
                      maxTicksLimit: 8,
                      maxRotation: 0,
                      fontSize: 10,
                    },
                  }],
                  yAxes: [{
                    ticks: { fontSize: 10 },
                  }],
                },
                tooltips: { mode: 'index', intersect: false },
                elements: { line: { tension: 0.3 } },
              }}
            />
          </div>
        ) : (
          <p className="text-muted text-center py-4 mb-0">
            No sensor data for the selected period.
          </p>
        )}

        {/* Data summary footer */}
        {!loading && history?.sensors?.length > 0 && (
          <div className="mt-3 pt-3 border-top d-flex" style={{ gap: 16 }}>
            {history.sensors.slice(0, 4).map((s, i) => {
              const last = s.buckets[s.buckets.length - 1];
              return (
                <span key={s.sensorId} className="text-xs" style={{ color: SENSOR_LINE_COLORS[i % SENSOR_LINE_COLORS.length] }}>
                  <strong>{s.sensorName}:</strong>{' '}
                  {last ? `${Number(last.avg).toFixed(2)} ${s.unit}` : '—'}
                </span>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
