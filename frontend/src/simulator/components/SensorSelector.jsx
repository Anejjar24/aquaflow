/**
 * SensorSelector.jsx
 * Two-step dropdown: Station → Sensor
 */
import React from 'react';

export default function SensorSelector({
  stations, sensors,
  selectedStation, onStationChange,
  selectedSensor,  onSensorChange,
  loadingStations, loadingSensors,
}) {
  return (
    <div className="sim-panel">
      <div className="sim-panel-header">
        <span className="sim-panel-title">◈ Target Selection</span>
      </div>
      <div className="sim-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Station */}
        <div className="sim-field">
          <label className="sim-label">Station</label>
          {loadingStations ? (
            <div className="sim-loading" style={{ padding: '8px 0' }}>
              <div className="sim-spinner" />
              <span>Loading stations…</span>
            </div>
          ) : (
            <select
              className="sim-select"
              value={selectedStation}
              onChange={(e) => onStationChange(e.target.value)}
            >
              <option value="">— Select a station —</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.status ? `  [${s.status.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sensor */}
        <div className="sim-field">
          <label className="sim-label">Sensor</label>
          {loadingSensors ? (
            <div className="sim-loading" style={{ padding: '8px 0' }}>
              <div className="sim-spinner" />
              <span>Loading sensors…</span>
            </div>
          ) : (
            <select
              className="sim-select"
              value={selectedSensor}
              onChange={(e) => onSensorChange(e.target.value)}
              disabled={!selectedStation}
            >
              <option value="">— Select a sensor —</option>
              {sensors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}  [{s.type?.toUpperCase()}]  ({s.unit})
                </option>
              ))}
            </select>
          )}
        </div>

        {!selectedStation && (
          <p style={{ fontSize: '0.65rem', color: 'var(--sim-text-muted)', margin: 0 }}>
            ↑ Select a station first to list its sensors.
          </p>
        )}
      </div>
    </div>
  );
}
