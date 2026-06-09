/**
 * SensorCard.jsx
 * Displays sensor metadata + current live value with animated status.
 */
import React from 'react';

const STATUS_LABEL = {
  active:   'ONLINE',
  inactive: 'INACTIVE',
  faulty:   'FAULTY',
  offline:  'OFFLINE',
};

export default function SensorCard({ sensor, liveValue, valueStatus, loadingMeta }) {
  if (loadingMeta) {
    return (
      <div className="sim-panel">
        <div className="sim-panel-header">
          <span className="sim-panel-title">◈ Sensor Info</span>
        </div>
        <div className="sim-loading">
          <div className="sim-spinner" />
          <span>Loading sensor metadata…</span>
        </div>
      </div>
    );
  }

  if (!sensor) {
    return (
      <div className="sim-panel">
        <div className="sim-panel-header">
          <span className="sim-panel-title">◈ Sensor Info</span>
        </div>
        <div className="sim-placeholder">NO SENSOR SELECTED</div>
      </div>
    );
  }

  const displayValue = liveValue !== null ? liveValue : sensor.lastReading;
  const currentStatus = valueStatus || 'normal';

  return (
    <div className="sim-panel">
      <div className="sim-panel-header">
        <span className="sim-panel-title">◈ Sensor Info</span>
        <span className={`sim-badge ${sensor.status ?? 'active'}`}>
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'currentColor', display: 'inline-block',
              animation: sensor.status === 'active' ? 'sim-pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
          {STATUS_LABEL[sensor.status] ?? sensor.status?.toUpperCase()}
        </span>
      </div>

      <div className="sim-sensor-card">
        <p className="sim-sensor-name">{sensor.name}</p>
        <p className="sim-sensor-meta">
          {sensor.type?.toUpperCase()} &nbsp;|&nbsp;
          {sensor.station?.name ?? 'Unknown Station'} &nbsp;|&nbsp;
          {sensor.location ?? 'n/a'}
        </p>

        {/* Live value display */}
        <div className={`sim-value-display ${currentStatus}`}>
          <span className={`sim-value-number ${currentStatus}`}>
            {displayValue !== null && displayValue !== undefined
              ? Number(displayValue).toFixed(2)
              : '—'}
          </span>
          <span className="sim-value-unit">{sensor.unit ?? ''}</span>
        </div>

        {/* Threshold row */}
        <div className="sim-threshold-row">
          <span className="min">
            ▼ MIN: {sensor.minThreshold !== null && sensor.minThreshold !== undefined
              ? Number(sensor.minThreshold).toFixed(2)
              : 'n/a'} {sensor.unit}
          </span>
          <span>
            {currentStatus !== 'normal' && (
              <span className={`sim-badge ${currentStatus}`}>
                ⚠ {currentStatus.toUpperCase()}
              </span>
            )}
          </span>
          <span className="max">
            ▲ MAX: {sensor.maxThreshold !== null && sensor.maxThreshold !== undefined
              ? Number(sensor.maxThreshold).toFixed(2)
              : 'n/a'} {sensor.unit}
          </span>
        </div>

        {/* Extra metadata */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['Device ID', sensor.deviceId ?? 'n/a'],
            ['Serial',    sensor.serialNumber ?? 'n/a'],
            ['Alerts',    sensor.alertEnabled ? 'ENABLED' : 'DISABLED'],
            ['Last seen', sensor.lastReadingAt
              ? new Date(sensor.lastReadingAt).toLocaleTimeString()
              : 'n/a'],
          ].map(([label, val]) => (
            <div key={label} style={{ fontSize: '0.6rem' }}>
              <span style={{ color: 'var(--sim-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
              </span>
              <br />
              <span style={{ color: 'var(--sim-text)' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
