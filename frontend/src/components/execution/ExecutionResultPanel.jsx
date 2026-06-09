import { useEffect, useState } from 'react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (ms == null) return null;
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function formatTime(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Render a single value cell in the key/value table
function CellValue({ val }) {
  if (val === null || val === undefined) return <span className="erp-null">null</span>;
  if (typeof val === 'boolean')
    return (
      <span className={val ? 'erp-bool-true' : 'erp-bool-false'}>{String(val)}</span>
    );
  if (typeof val === 'object')
    return <span className="erp-kv-nested">{JSON.stringify(val)}</span>;
  return <>{String(val)}</>;
}

// ─── OutputDisplay ─────────────────────────────────────────────────────────────
// Renders the final workflow output in a type-appropriate way.
// No raw JSON.stringify — each type gets its own presentational treatment.

function OutputDisplay({ output }) {
  // ── null / undefined ──
  if (output === null || output === undefined) {
    return <div className="erp-null-output">No output returned</div>;
  }

  // ── number ── display large and prominent
  if (typeof output === 'number') {
    return (
      <div className="erp-output-number">
        {Number.isInteger(output) ? output.toLocaleString() : output}
      </div>
    );
  }

  // ── boolean ──
  if (typeof output === 'boolean') {
    return (
      <div className={`erp-output-bool ${output ? 'erp-bool-true' : 'erp-bool-false'}`}>
        {String(output)}
      </div>
    );
  }

  // ── string ── plain readable text
  if (typeof output === 'string') {
    return <div className="erp-output-text">{output}</div>;
  }

  // ── array ── indexed rows
  if (Array.isArray(output)) {
    if (output.length === 0)
      return <div className="erp-null-output">[ ] (empty array)</div>;
    return (
      <table className="erp-kv-table">
        <tbody>
          {output.map((item, i) => (
            <tr key={i}>
              <td className="erp-kv-key">[{i}]</td>
              <td className="erp-kv-val">
                <CellValue val={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // ── object ── two-column key/value table; strip internal `branch` field
  if (typeof output === 'object') {
    const entries = Object.entries(output).filter(([k]) => k !== 'branch');
    if (entries.length === 0)
      return <div className="erp-null-output">{ } (empty object)</div>;
    return (
      <table className="erp-kv-table">
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key}>
              <td className="erp-kv-key">{key}</td>
              <td className="erp-kv-val">
                <CellValue val={val} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return <div className="erp-output-text">{String(output)}</div>;
}

// ─── ExecutionResultPanel ──────────────────────────────────────────────────────

const STATUS = {
  idle:    { dot: '#475569', label: 'Ready',   cls: 'erp-badge--idle'    },
  running: { dot: '#f59e0b', label: 'Running', cls: 'erp-badge--running' },
  success: { dot: '#22c55e', label: 'Success', cls: 'erp-badge--success' },
  failed:  { dot: '#ef4444', label: 'Failed',  cls: 'erp-badge--failed'  },
};

export default function ExecutionResultPanel({ result, isRunning }) {
  const [open, setOpen] = useState(false);

  // Auto-expand whenever a new result arrives
  useEffect(() => {
    if (result !== null && result !== undefined) setOpen(true);
  }, [result]);

  const hasResult  = result !== null && result !== undefined;
  const isError    = hasResult && (result.error || result.status === 'failed');
  const statusKey  = isRunning ? 'running' : isError ? 'failed' : hasResult ? 'success' : 'idle';
  const cfg        = STATUS[statusKey];

  return (
    <div className={`erp-panel${open ? ' erp-panel--open' : ''}`}>

      {/* ── Status bar (always visible) ── */}
      <button
        className="erp-statusbar"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={open ? 'Collapse execution result' : 'Expand execution result'}
      >
        {/* Animated dot */}
        <span
          className={`erp-dot${isRunning ? ' erp-dot--pulse' : ''}`}
          style={{ background: cfg.dot }}
        />

        {/* Status badge */}
        <span className={`erp-badge ${cfg.cls}`}>{cfg.label}</span>

        {/* Duration */}
        {result?.durationMs != null && (
          <span className="erp-meta">
            <i className="fa fa-clock-o" style={{ marginRight: 4 }} />
            {formatDuration(result.durationMs)}
          </span>
        )}

        {/* Timestamp */}
        {result?.startedAt != null && (
          <span className="erp-meta">{formatTime(result.startedAt)}</span>
        )}

        {/* Panel title — centred */}
        <span className="erp-panel-title">Execution Result</span>

        {/* Collapse chevron */}
        <span className="erp-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Collapsible body ── */}
      {open && (
        <div className="erp-body">

          {/* Idle / no run yet */}
          {!hasResult && !isRunning && (
            <p className="erp-empty">
              No run yet — click <strong>Run</strong> to execute the workflow.
            </p>
          )}

          {/* Running spinner */}
          {isRunning && (
            <p className="erp-running-msg">
              <span className="erp-spinner" />
              Workflow is executing…
            </p>
          )}

          {/* Result */}
          {hasResult && !isRunning && (
            <div className="erp-sections">

              {/* ── Output section (success only) ── */}
              {!isError && (
                <section className="erp-section">
                  <h4 className="erp-section-title">
                    <i className="fa fa-flag-checkered" style={{ marginRight: 6 }} />
                    Output
                  </h4>
                  <div className="erp-output-box">
                    <OutputDisplay output={result.output} />
                  </div>
                </section>
              )}

              {/* ── Error section (failures only) ── */}
              {isError && (
                <section className="erp-section erp-section--error">
                  <h4 className="erp-section-title erp-section-title--error">
                    <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
                    Execution Failed
                  </h4>
                  <div className="erp-error-box">
                    <span className="erp-error-msg">
                      {result.error || 'An unexpected error occurred during execution.'}
                    </span>
                  </div>
                </section>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
