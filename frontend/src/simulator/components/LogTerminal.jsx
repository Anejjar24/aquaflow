/**
 * LogTerminal.jsx
 * Cyberpunk terminal-style log panel. Auto-scrolls to newest entry.
 */
import React, { useEffect, useRef } from 'react';

export default function LogTerminal({ logs, logCount, socketConnected }) {
  const bodyRef = useRef(null);

  // Auto-scroll to bottom on new log
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logCount]);

  const clearLogs = () => {
    // Expose via prop if needed — for now the parent controls state
  };

  return (
    <div className="sim-terminal">
      {/* Title bar */}
      <div className="sim-terminal-header">
        <span className="sim-terminal-dot" style={{ background: '#ff2d55' }} />
        <span className="sim-terminal-dot" style={{ background: '#ffd60a' }} />
        <span className="sim-terminal-dot" style={{ background: '#00ff88' }} />
        <span style={{ marginLeft: 8, fontSize: '0.6rem', color: 'var(--sim-text-muted)', textTransform: 'uppercase', letterSpacing: 2 }}>
          SIM-TERMINAL — AQUAFLOW LAB
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: socketConnected ? 'var(--sim-green)' : 'var(--sim-red)',
              boxShadow: socketConnected ? '0 0 6px var(--sim-green)' : '0 0 6px var(--sim-red)',
              animation: socketConnected ? 'sim-pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
          <span style={{ fontSize: '0.55rem', color: 'var(--sim-text-muted)' }}>
            {socketConnected ? 'WS:LIVE' : 'WS:OFF'}
          </span>
        </span>
      </div>

      {/* Log body */}
      <div className="sim-terminal-body" ref={bodyRef}>
        {logs.length === 0 && (
          <div style={{ color: 'var(--sim-text-muted)', fontSize: '0.65rem', padding: '4px 0' }}>
            Waiting for events…
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="sim-log-line">
            <span className="sim-log-time">[{log.time}]</span>
            <span className={`sim-log-msg ${log.level}`}>{log.message}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sim-terminal-footer">
        <span style={{ fontSize: '0.55rem', color: 'var(--sim-text-muted)' }}>
          {logCount} events total
        </span>
        <span style={{ fontSize: '0.55rem', color: 'var(--sim-text-muted)' }}>
          aquaflow@sim-lab:~$ <span className="sim-terminal-cursor" />
        </span>
      </div>
    </div>
  );
}
