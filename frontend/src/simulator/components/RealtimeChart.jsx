/**
 * RealtimeChart.jsx
 * Real-time telemetry line chart using react-chartjs-2 v2 + Chart.js v2
 * (the versions already installed in this project).
 *
 * react-chartjs-2 v2 uses the <Line> component declaratively — no
 * Chart.register() needed (that's a v3+ API).
 */
import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

const COLORS = {
  normal:   { line: '#1a6fc4', fill: 'rgba(26,111,196,0.08)',  point: '#1a6fc4' },
  warning:  { line: '#c47d00', fill: 'rgba(196,125,0,0.08)',   point: '#c47d00' },
  critical: { line: '#d63b3b', fill: 'rgba(214,59,59,0.08)',   point: '#d63b3b' },
};

export default function RealtimeChart({ data, sensor, valueStatus }) {
  const colors = COLORS[valueStatus] || COLORS.normal;

  const minTh = sensor?.minThreshold != null ? Number(sensor.minThreshold) : null;
  const maxTh = sensor?.maxThreshold != null ? Number(sensor.maxThreshold) : null;

  // ── Chart.js v2 data object ─────────────────────────────────────────────
  const chartData = useMemo(() => ({
    labels: data.map((d) => d.time),
    datasets: [
      {
        label: sensor?.name ?? 'Value',
        data:  data.map((d) => d.value),
        borderColor:          colors.line,
        backgroundColor:      colors.fill,
        pointBackgroundColor: colors.point,
        pointBorderColor:     colors.point,
        borderWidth: 2,
        pointRadius: data.length < 20 ? 3 : 2,
        fill: true,
        lineTension: 0.35,
      },
    ],
  }), [data, colors, sensor]);

  // ── Chart.js v2 options ─────────────────────────────────────────────────
  const options = useMemo(() => {
    // Annotation lines drawn with a custom plugin
    const annotations = [];
    if (minTh !== null) annotations.push({ value: minTh, color: '#0d9e6e', label: `MIN ${minTh}` });
    if (maxTh !== null) annotations.push({ value: maxTh, color: '#d63b3b', label: `MAX ${maxTh}` });

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 200 },
      legend:  { display: false },
      tooltips: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#ffffff',
        borderColor: '#d1dce8',
        borderWidth: 1,
        titleFontColor: '#1a6fc4',
        bodyFontColor:  '#1a2b40',
        footerFontColor: '#6b84a0',
        titleFontFamily: 'Segoe UI, sans-serif',
        bodyFontFamily:  'Segoe UI, sans-serif',
        titleFontSize: 11,
        bodyFontSize:  11,
        callbacks: {
          label: (item) => ` ${item.yLabel} ${sensor?.unit ?? ''}`,
        },
      },
      scales: {
        xAxes: [{
          gridLines: { color: 'rgba(209,220,232,0.8)', zeroLineColor: 'rgba(209,220,232,0.8)' },
          ticks: {
            fontColor:  '#6b84a0',
            fontFamily: 'Segoe UI, sans-serif',
            fontSize:   10,
            maxTicksLimit: 8,
            maxRotation: 0,
          },
        }],
        yAxes: [{
          gridLines: { color: 'rgba(209,220,232,0.8)', zeroLineColor: 'rgba(209,220,232,0.8)' },
          ticks: {
            fontColor:  '#6b84a0',
            fontFamily: 'Segoe UI, sans-serif',
            fontSize:   10,
          },
        }],
      },
      // Custom plugin: dark background + threshold lines
      // In Chart.js v2, plugins are passed via options.plugins is not standard;
      // we use the `plugins` prop on <Line> below instead.
      _thresholdAnnotations: annotations, // stored here, read by custom plugin
    };
  }, [minTh, maxTh, sensor]);

  // ── Custom plugins for Chart.js v2 ─────────────────────────────────────
  // In react-chartjs-2 v2, chart-level plugins are registered globally or
  // passed as the `plugins` array prop (not inside options).
  const plugins = useMemo(() => [
    {
      // White canvas background
      beforeDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      },
      // Threshold dashed lines
      afterDraw(chart) {
        const annotations = chart.options._thresholdAnnotations;
        if (!annotations?.length) return;
        const { ctx, chartArea, scales } = chart;
        const yScale = scales['y-axis-0'];
        if (!yScale || !chartArea) return;

        annotations.forEach(({ value, color, label }) => {
          const y = yScale.getPixelForValue(value);
          if (y < chartArea.top || y > chartArea.bottom) return;
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = color;
          ctx.lineWidth   = 1.5;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(chartArea.left,  y);
          ctx.lineTo(chartArea.right, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle   = color;
          ctx.font        = 'bold 9px Segoe UI, sans-serif';
          ctx.fillText(label, chartArea.left + 4, y - 4);
          ctx.restore();
        });
      },
    },
  ], []);

  return (
    <div className="sim-panel">
      <div className="sim-panel-header">
        <span className="sim-panel-title">◈ Live Telemetry</span>
        {data.length > 0 && (
          <span style={{ fontSize: '0.6rem', color: 'var(--sim-text-muted)' }}>
            {data.length} / 30 pts &nbsp;·&nbsp; {sensor?.unit ?? ''}
          </span>
        )}
      </div>

      {!sensor ? (
        <div className="sim-placeholder">SELECT A SENSOR TO START PLOTTING</div>
      ) : data.length === 0 ? (
        <div className="sim-placeholder">
          <div className="sim-spinner" style={{ margin: '0 auto 8px' }} />
          AWAITING FIRST DATA POINT…
        </div>
      ) : (
        <div style={{ height: 200, padding: '8px 16px 16px' }}>
          <Line
            data={chartData}
            options={options}
            plugins={plugins}
          />
        </div>
      )}
    </div>
  );
}
