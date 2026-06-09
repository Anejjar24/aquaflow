/**
 * SensorLabPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AquaFlow — IoT Sensor Simulation Lab
 *
 * A completely isolated experimental/testing interface with a cyberpunk SCADA
 * visual identity. NOT part of the main dashboard.
 *
 * Purpose: test workflows, simulate sensors, stress-test monitoring,
 *          demonstrate the platform during presentations.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import '../styles/simulator.css';
import { useSimulation }    from '../hooks/useSimulation';
import SensorSelector       from '../components/SensorSelector';
import SensorCard           from '../components/SensorCard';
import SimulationControls   from '../components/SimulationControls';
import RealtimeChart        from '../components/RealtimeChart';
import LogTerminal          from '../components/LogTerminal';

export default function SensorLabPage() {
  const sim = useSimulation();

  return (
    <div className="sim-lab">

      {/* ── Header ── */}
      <header className="sim-header">
        <div className="sim-header-title">
          <span className="sim-status-dot" style={sim.socketConnected ? {} : { background: 'var(--sim-red)', boxShadow: '0 0 8px var(--sim-red)', animation: 'none' }} />
          <h1>AquaFlow Sensor Lab</h1>
          <span className="sim-tag">DEV / SIM</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.65rem', color: 'var(--sim-text-muted)' }}>
          {sim.autoRunning && (
            <span className="sim-running-badge">
              <span className="dot" />
              AUTO: {sim.activeMode ? sim.activeMode.toUpperCase() : 'CUSTOM'} @ {sim.autoInterval}ms
            </span>
          )}
          <span>
            SENT: <span style={{ color: 'var(--sim-cyan)' }}>{sim.stats.sent}</span>
          </span>
          <span>
            ALERTS: <span style={{ color: sim.stats.alerts > 0 ? 'var(--sim-red)' : 'var(--sim-text-muted)' }}>
              {sim.stats.alerts}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: sim.socketConnected ? 'var(--sim-green)' : 'var(--sim-red)',
                boxShadow: sim.socketConnected ? '0 0 6px var(--sim-green)' : '0 0 6px var(--sim-red)',
                display: 'inline-block',
              }}
            />
            {sim.socketConnected ? 'WS LIVE' : 'WS OFFLINE'}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="sim-body">

        {/* ── Left column: Selector + Sensor info ── */}
        <div className="sim-left">
          <SensorSelector
            stations={sim.stations}
            sensors={sim.sensors}
            selectedStation={sim.selectedStation}
            onStationChange={sim.setSelectedStation}
            selectedSensor={sim.selectedSensor}
            onSensorChange={sim.setSelectedSensor}
            loadingStations={sim.loadingStations}
            loadingSensors={sim.loadingSensors}
          />

          <SensorCard
            sensor={sim.sensorMeta}
            liveValue={sim.liveValue}
            valueStatus={sim.valueStatus}
            loadingMeta={sim.loadingMeta}
          />
        </div>

        {/* ── Right: top row (chart + controls) ── */}
        <div className="sim-right-top">

          {/* Stats row */}
          {sim.sensorMeta && (
            <div className="sim-panel">
              <div className="sim-stats-row">
                {[
                  ['SENT',    sim.stats.sent],
                  ['ALERTS',  sim.stats.alerts],
                  ['SESSION MIN', sim.stats.minSeen !== null ? Number(sim.stats.minSeen).toFixed(2) : '—'],
                  ['SESSION MAX', sim.stats.maxSeen !== null ? Number(sim.stats.maxSeen).toFixed(2) : '—'],
                ].map(([label, val]) => (
                  <div key={label} className="sim-stat">
                    <span className="sim-stat-value">{val}</span>
                    <span className="sim-stat-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart */}
          <RealtimeChart
            data={sim.chartData}
            sensor={sim.sensorMeta}
            valueStatus={sim.valueStatus}
          />
        </div>

        {/* ── Right: bottom row (controls + terminal) ── */}
        <div className="sim-right-bottom" style={{ gridColumn: '2' }}>
          <SimulationControls
            sensor={sim.sensorMeta}
            manualValue={sim.manualValue}
            setManualValue={sim.setManualValue}
            sendManual={sim.sendManual}
            sending={sim.sending}
            autoRunning={sim.autoRunning}
            autoMin={sim.autoMin}
            setAutoMin={sim.setAutoMin}
            autoMax={sim.autoMax}
            setAutoMax={sim.setAutoMax}
            autoInterval={sim.autoInterval}
            setAutoInterval={sim.setAutoInterval}
            startAuto={sim.startAuto}
            stopAuto={sim.stopAuto}
            activeMode={sim.activeMode}
            startMode={sim.startMode}
            error={sim.error}
            setError={sim.setError}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Terminal */}
            <div className="sim-panel">
              <div className="sim-panel-header">
                <span className="sim-panel-title">◈ Event Log</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--sim-text-muted)' }}>
                  {sim.logCount} events
                </span>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <LogTerminal
                  logs={sim.logs}
                  logCount={sim.logCount}
                  socketConnected={sim.socketConnected}
                />
              </div>
            </div>

            {/* Architecture flow */}
            <div className="sim-panel">
              <div className="sim-panel-header">
                <span className="sim-panel-title">◈ Data Flow</span>
              </div>
              <div className="sim-panel-body">
                {[
                  { label: 'Simulator UI',         color: 'var(--sim-cyan)',   active: true },
                  { label: 'POST /sensors/:id/reading', color: 'var(--sim-text-muted)', active: true },
                  { label: 'Sensor Processing',    color: 'var(--sim-cyan)',   active: !!sim.sensorMeta },
                  { label: 'Workflow Engine',       color: 'var(--sim-green)',  active: !!sim.sensorMeta },
                  { label: 'Socket.IO Broadcast',  color: '#7c4dff',           active: sim.socketConnected },
                  { label: 'Monitoring Dashboard', color: 'var(--sim-cyan)',   active: sim.socketConnected },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: step.active ? step.color : 'var(--sim-border)',
                      boxShadow: step.active ? `0 0 6px ${step.color}` : 'none',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '0.65rem', color: step.active ? step.color : 'var(--sim-border)' }}>
                      {step.label}
                    </span>
                    {i < 5 && (
                      <span style={{
                        marginLeft: 'auto', fontSize: '0.6rem',
                        color: step.active ? step.color : 'var(--sim-border)',
                      }}>↓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
