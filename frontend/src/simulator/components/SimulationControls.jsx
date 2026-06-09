/**
 * SimulationControls.jsx
 * Manual send + Auto random simulation + Quick mode buttons.
 */
import React from 'react';

export default function SimulationControls({
  sensor,
  // manual
  manualValue, setManualValue, sendManual, sending,
  // auto
  autoRunning, autoMin, setAutoMin, autoMax, setAutoMax,
  autoInterval, setAutoInterval, startAuto, stopAuto,
  // modes
  activeMode, startMode,
  // error
  error, setError,
}) {
  const disabled = !sensor;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Error banner */}
      {error && (
        <div className="sim-error" onClick={() => setError('')} style={{ cursor: 'pointer' }}>
          ✗ {error} &nbsp; <span style={{ opacity: 0.6 }}>(click to dismiss)</span>
        </div>
      )}

      {/* ── Manual Send ── */}
      <div className="sim-panel">
        <div className="sim-panel-header">
          <span className="sim-panel-title">◈ Manual Inject</span>
        </div>
        <div className="sim-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="sim-field">
            <label className="sim-label">Value ({sensor?.unit ?? 'unit'})</label>
            <input
              type="number"
              className="sim-input"
              placeholder={`e.g. ${sensor?.lastReading ?? '42.5'}`}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !disabled && sendManual()}
              disabled={disabled}
              step="any"
            />
          </div>
          <button
            className="sim-btn sim-btn-cyan"
            onClick={sendManual}
            disabled={disabled || sending || !manualValue}
            style={{ width: '100%', position: 'relative' }}
          >
            {sending ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="sim-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
                SENDING…
              </span>
            ) : '▶ SEND'}
          </button>
        </div>
      </div>

      {/* ── Auto Random ── */}
      <div className="sim-panel">
        <div className="sim-panel-header">
          <span className="sim-panel-title">◈ Auto Random</span>
          {autoRunning && (
            <span className="sim-running-badge">
              <span className="dot" /> RUNNING
            </span>
          )}
        </div>
        <div className="sim-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="sim-range-row">
            <div>
              <label className="sim-label">Min</label>
              <input
                type="number"
                className="sim-input"
                value={autoMin}
                onChange={(e) => setAutoMin(parseFloat(e.target.value) || 0)}
                disabled={disabled || autoRunning}
                step="any"
              />
            </div>
            <div>
              <label className="sim-label">Max</label>
              <input
                type="number"
                className="sim-input"
                value={autoMax}
                onChange={(e) => setAutoMax(parseFloat(e.target.value) || 100)}
                disabled={disabled || autoRunning}
                step="any"
              />
            </div>
          </div>

          <div className="sim-field">
            <label className="sim-label">
              Interval — {autoInterval} ms
            </label>
            <input
              type="range"
              className="sim-input"
              min={200}
              max={10000}
              step={200}
              value={autoInterval}
              onChange={(e) => setAutoInterval(Number(e.target.value))}
              disabled={disabled || autoRunning}
            />
            <div className="sim-interval-display">
              {autoInterval < 1000
                ? `${autoInterval} ms`
                : `${(autoInterval / 1000).toFixed(1)} s`}
              &nbsp;per reading
            </div>
          </div>

          <div className="sim-btn-row">
            {!autoRunning ? (
              <button
                className="sim-btn sim-btn-green"
                style={{ flex: 1 }}
                onClick={() => startAuto(null)}
                disabled={disabled}
              >
                ▶ START
              </button>
            ) : (
              <button
                className="sim-btn sim-btn-red"
                style={{ flex: 1 }}
                onClick={stopAuto}
              >
                ■ STOP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Modes ── */}
      <div className="sim-panel">
        <div className="sim-panel-header">
          <span className="sim-panel-title">◈ Quick Modes</span>
        </div>
        <div className="sim-panel-body">
          <div className="sim-mode-grid">
            {[
              { id: 'normal',   label: '✓ NORMAL',   sub: 'Safe values' },
              { id: 'warning',  label: '⚠ WARNING',  sub: 'Near threshold' },
              { id: 'critical', label: '✗ CRITICAL', sub: 'Over threshold' },
              { id: 'chaos',    label: '⚡ CHAOS',    sub: 'Unstable' },
            ].map(({ id, label, sub }) => (
              <button
                key={id}
                className={`sim-mode-btn ${id} ${activeMode === id ? 'active' : ''}`}
                onClick={() => {
                  if (autoRunning && activeMode === id) {
                    stopAuto();
                  } else {
                    startMode(id);
                  }
                }}
                disabled={disabled}
              >
                {label}
                <br />
                <span style={{ fontWeight: 400, letterSpacing: 0 }}>{sub}</span>
                {autoRunning && activeMode === id && (
                  <span style={{ display: 'block', marginTop: 2, fontSize: '0.55rem' }}>
                    [click to stop]
                  </span>
                )}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.6rem', color: 'var(--sim-text-muted)', marginTop: 10, marginBottom: 0, textAlign: 'center' }}>
            Modes use the sensor's own thresholds to generate appropriate values.
          </p>
        </div>
      </div>

    </div>
  );
}
