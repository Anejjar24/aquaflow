import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadWorkflowJson } from 'engine/graphSerializer';
import { clearExecutionHistory, loadExecutionHistory } from 'engine/executionHistoryManager';
import { clearTriggerSettings, clearWorkflowDraft } from 'engine/autosaveManager';
import { deleteWorkflow, loadWorkflows, saveWorkflow } from 'services/workflowApi';

// ─── Small helpers ─────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = {
    success:  { cls: 'wl-badge--success', label: 'Success' },
    failed:   { cls: 'wl-badge--failed',  label: 'Failed'  },
    running:  { cls: 'wl-badge--running', label: 'Running' },
    never:    { cls: 'wl-badge--idle',    label: 'Never run' },
    completed:{ cls: 'wl-badge--success', label: 'Success' },
  };
  const c = cfg[status] || cfg.never;
  return <span className={`wl-badge ${c.cls}`}>{c.label}</span>;
}

// ─── OutputPreview ─────────────────────────────────────────────────────────────
// Renders a compact, readable preview of an execution output value.

function OutputPreview({ output, full }) {
  if (output === null || output === undefined)
    return <span className="wl-out-null">null</span>;
  if (typeof output === 'number')
    return <span className="wl-out-number">{output.toLocaleString()}</span>;
  if (typeof output === 'boolean')
    return <span className={output ? 'wl-out-true' : 'wl-out-false'}>{String(output)}</span>;
  if (typeof output === 'string') {
    const display = full ? output : output.slice(0, 120) + (output.length > 120 ? '…' : '');
    return <span className="wl-out-text">{display}</span>;
  }
  if (typeof output === 'object') {
    const entries = Object.entries(output).filter(([k]) => k !== 'branch');
    if (full) {
      return (
        <table className="wl-out-table">
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td className="wl-out-key">{k}</td>
                <td className="wl-out-val">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    // compact preview: first 2 entries
    const preview = entries.slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
    return <span className="wl-out-text">{preview}{entries.length > 2 ? ' …' : ''}</span>;
  }
  return <span className="wl-out-text">{String(output).slice(0, 120)}</span>;
}

// ─── HistoryRow ───────────────────────────────────────────────────────────────

function HistoryRow({ run }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="wl-run-row">
      <button className="wl-run-summary" onClick={() => setExpanded(o => !o)}>
        <StatusBadge status={run.status} />
        <span className="wl-run-time">{fmt(run.timestamp)}</span>
        <span className="wl-run-meta">
          <i className="fa fa-clock-o" style={{ marginRight: 4 }} />
          {fmtDuration(run.durationMs)}
        </span>
        {run.status === 'success' && run.output !== null && run.output !== undefined && (
          <span className="wl-run-preview">
            <OutputPreview output={run.output} full={false} />
          </span>
        )}
        {run.status === 'failed' && run.error && (
          <span className="wl-run-error-preview">{run.error.slice(0, 80)}</span>
        )}
        <span className="wl-run-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="wl-run-detail">
          {run.status === 'success' && (
            <>
              <span className="wl-run-detail-label">Output</span>
              <div className="wl-run-detail-value">
                <OutputPreview output={run.output} full={true} />
              </div>
            </>
          )}
          {run.status === 'failed' && run.error && (
            <>
              <span className="wl-run-detail-label wl-run-detail-label--error">Error</span>
              <div className="wl-run-detail-value wl-run-detail-value--error">{run.error}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WorkflowCard ─────────────────────────────────────────────────────────────

function WorkflowCard({
  wf,
  onOpen,
  onExport,
  onDelete,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  deleting,
  historyExpanded,
  onToggleHistory,
}) {
  const history = useMemo(() => loadExecutionHistory(wf.id), [wf.id, historyExpanded]);
  const lastRun = history[0] || null;
  const nodeCount = wf.graph?.nodes?.length ?? 0;
  const edgeCount = wf.graph?.edges?.length ?? 0;

  return (
    <div className="wl-card">
      {/* Card header */}
      <div className="wl-card-header">
        <div className="wl-card-icon">
          <i className="ni ni-collection" />
        </div>
        <div className="wl-card-meta">
          <span className="wl-card-name">{wf.name || 'Untitled Workflow'}</span>
          <span className="wl-card-sub">
            {nodeCount} node{nodeCount !== 1 ? 's' : ''}
            {edgeCount > 0 && ` · ${edgeCount} connection${edgeCount !== 1 ? 's' : ''}`}
            {wf.createdAt && ` · Created ${fmtRelative(wf.createdAt)}`}
            {wf.updatedAt && ` · Modified ${fmtRelative(wf.updatedAt)}`}
          </span>
        </div>
        <div className="wl-card-status">
          {lastRun
            ? <StatusBadge status={lastRun.status} />
            : <StatusBadge status="never" />
          }
          {lastRun && (
            <span className="wl-card-last-run">{fmtRelative(lastRun.timestamp)}</span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="wl-card-actions">
        {!deleteConfirm ? (
          <>
            <button className="wl-btn wl-btn--primary" onClick={() => onOpen(wf)}>
              <i className="fa fa-external-link-alt" style={{ marginRight: 5 }} />
              Open
            </button>
            <button className="wl-btn wl-btn--secondary" onClick={() => onExport(wf)}>
              <i className="fa fa-download" style={{ marginRight: 5 }} />
              Export
            </button>
            <button
              className={`wl-btn wl-btn--ghost${historyExpanded ? ' wl-btn--active' : ''}`}
              onClick={onToggleHistory}
            >
              <i className="fa fa-history" style={{ marginRight: 5 }} />
              History
              {history.length > 0 && (
                <span className="wl-history-count">{history.length}</span>
              )}
            </button>
            <button className="wl-btn wl-btn--danger" onClick={onDelete}>
              <i className="fa fa-trash" />
            </button>
          </>
        ) : (
          <div className="wl-delete-confirm">
            <span className="wl-delete-msg">
              <i className="fa fa-exclamation-triangle" style={{ marginRight: 6, color: '#f87171' }} />
              Delete <strong>{wf.name}</strong>? This cannot be undone.
            </span>
            <button
              className="wl-btn wl-btn--danger"
              onClick={onDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button className="wl-btn wl-btn--secondary" onClick={onDeleteCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Execution history inline panel */}
      {historyExpanded && (
        <div className="wl-history-panel">
          <div className="wl-history-header">
            <span>Execution History</span>
            <span className="wl-history-sub">
              {history.length === 0
                ? 'No runs recorded yet'
                : `${history.length} run${history.length !== 1 ? 's' : ''} · newest first`}
            </span>
          </div>
          {history.length === 0 ? (
            <p className="wl-history-empty">
              Run this workflow from the builder to see history here.
            </p>
          ) : (
            <div className="wl-run-list">
              {history.map((run) => (
                <HistoryRow key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WorkflowLibrary ──────────────────────────────────────────────────────────

/**
 * WorkflowLibrary
 *
 * Full-screen dark overlay — acts as a central management hub for all saved
 * workflows.  Fetches workflow list from the backend, shows per-workflow
 * execution history from localStorage, and supports open/export/delete/import.
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   onOpen    {(wf: object) => void}  — called with full workflow entity to load it
 */
export default function WorkflowLibrary({ isOpen, onClose, onOpen }) {
  const [workflows, setWorkflows]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [sort, setSort]               = useState('modified');
  const [expandedHistory, setExpanded]= useState(null);
  const [deleteConfirm, setDeleteCfm] = useState(null);
  const [deleting, setDeleting]       = useState(null);

  // Import flow
  const importRef                     = useRef(null);
  const [importData, setImportData]   = useState(null);   // parsed JSON
  const [importName, setImportName]   = useState('');
  const [importErr, setImportErr]     = useState('');
  const [importing, setImporting]     = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadWorkflows();
      setWorkflows(list);
    } catch {
      setError('Could not load workflows — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refresh();
      setSearch('');
      setExpanded(null);
      setDeleteCfm(null);
      setImportData(null);
    }
  }, [isOpen]);

  // ── Filtered + sorted list ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = workflows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((wf) => (wf.name || '').toLowerCase().includes(q));
    }
    if (sort === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'modified') {
      list = [...list].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
      );
    } else if (sort === 'status') {
      const rank = { failed: 0, success: 1, never: 2 };
      list = [...list].sort((a, b) => {
        const ha = loadExecutionHistory(a.id)[0]?.status || 'never';
        const hb = loadExecutionHistory(b.id)[0]?.status || 'never';
        return (rank[ha] ?? 2) - (rank[hb] ?? 2);
      });
    }
    return list;
  }, [workflows, search, sort]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleOpen = (wf) => {
    onOpen(wf);
    onClose();
  };

  const handleExport = (wf) => {
    downloadWorkflowJson(wf.graph || wf);
  };

  const handleDelete = async (wf) => {
    setDeleting(wf.id);
    try {
      await deleteWorkflow(wf.id);
      clearWorkflowDraft(wf.id);
      clearTriggerSettings(wf.id);
      clearExecutionHistory(wf.id);
      setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
      setDeleteCfm(null);
      if (expandedHistory === wf.id) setExpanded(null);
    } catch {
      setError('Could not delete workflow — try again.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.nodes)) throw new Error('Invalid workflow — missing nodes array.');
        setImportData(data);
        setImportName(data.name && data.name !== 'Workflow Builder' ? data.name : '');
        setImportErr('');
      } catch (err) {
        setImportErr(err.message);
        setImportData(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const name = importName.trim();
    if (!name) { setImportErr('Please enter a workflow name.'); return; }
    setImporting(true);
    try {
      await saveWorkflow(importData, {
        name,
        triggerType: importData.triggerType || 'manual',
        triggerConfig: importData.triggerConfig || {},
        isActive: false,
      });
      setImportData(null);
      setImportName('');
      setImportErr('');
      await refresh();
    } catch (err) {
      setImportErr(`Could not import: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="wl-overlay" role="dialog" aria-modal="true" aria-label="Workflow Library">

      {/* ── Panel ── */}
      <div className="wl-panel">

        {/* Header */}
        <div className="wl-panel-header">
          <div className="wl-panel-title">
            <i className="ni ni-collection" style={{ marginRight: 10 }} />
            Workflow Library
          </div>
          <button className="wl-close-btn" onClick={onClose} aria-label="Close library">
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="wl-panel-toolbar">
          <label className="wl-import-label" title="Import a .json workflow file">
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
            <i className="fa fa-upload" style={{ marginRight: 6 }} />
            Import
          </label>

          <div className="wl-search-wrap">
            <i className="fa fa-search wl-search-icon" />
            <input
              className="wl-search-input"
              placeholder="Search workflows…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="wl-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>

          <select
            className="wl-sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="modified">Last Modified</option>
            <option value="name">Name A–Z</option>
            <option value="status">Run Status</option>
          </select>

          <span className="wl-count">
            {filtered.length} / {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </span>

          <button className="wl-refresh-btn" onClick={refresh} title="Refresh list" disabled={loading}>
            <i className={`fa fa-sync${loading ? ' fa-spin' : ''}`} />
          </button>
        </div>

        {/* Import form strip */}
        {importData && (
          <div className="wl-import-strip">
            <i className="fa fa-file-import" style={{ color: '#60a5fa', marginRight: 8 }} />
            <span className="wl-import-label-text">
              Importing <strong>{importData.nodes?.length} nodes</strong> — name this workflow:
            </span>
            <input
              className="wl-import-name-input"
              placeholder="Workflow name"
              value={importName}
              onChange={(e) => { setImportName(e.target.value); setImportErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmImport()}
              autoFocus
            />
            {importErr && <span className="wl-import-error">{importErr}</span>}
            <button
              className="wl-btn wl-btn--primary"
              onClick={handleConfirmImport}
              disabled={importing}
            >
              {importing ? 'Saving…' : 'Add to Library'}
            </button>
            <button
              className="wl-btn wl-btn--secondary"
              onClick={() => { setImportData(null); setImportErr(''); }}
            >
              Cancel
            </button>
          </div>
        )}

        {importErr && !importData && (
          <div className="wl-import-error-bar">{importErr}</div>
        )}

        {/* Main content */}
        <div className="wl-panel-content">

          {/* Loading */}
          {loading && (
            <div className="wl-loading">
              <span className="wl-spinner" />
              Loading workflows…
            </div>
          )}

          {/* API error */}
          {!loading && error && (
            <div className="wl-error-msg">
              <i className="fa fa-exclamation-triangle" style={{ marginRight: 8 }} />
              {error}
              <button className="wl-btn wl-btn--ghost" onClick={refresh} style={{ marginLeft: 12 }}>
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div className="wl-empty-state">
              {search ? (
                <>
                  <i className="fa fa-search" style={{ fontSize: 32, marginBottom: 12, color: '#334155' }} />
                  <p>No workflows match <strong>"{search}"</strong></p>
                  <button className="wl-btn wl-btn--ghost" onClick={() => setSearch('')}>
                    Clear search
                  </button>
                </>
              ) : (
                <>
                  <i className="ni ni-collection" style={{ fontSize: 40, marginBottom: 14, color: '#334155' }} />
                  <p>No saved workflows yet.</p>
                  <p className="wl-empty-sub">
                    Build a workflow in the editor and click <strong>Save</strong>, or use{' '}
                    <strong>Import</strong> to upload an existing .json file.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Workflow cards */}
          {!loading && !error && filtered.length > 0 && (
            <div className="wl-card-list">
              {filtered.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  wf={wf}
                  onOpen={handleOpen}
                  onExport={handleExport}
                  onDelete={() => setDeleteCfm(wf.id)}
                  deleteConfirm={deleteConfirm === wf.id}
                  onDeleteConfirm={() => handleDelete(wf)}
                  onDeleteCancel={() => setDeleteCfm(null)}
                  deleting={deleting === wf.id}
                  historyExpanded={expandedHistory === wf.id}
                  onToggleHistory={() =>
                    setExpanded((prev) => (prev === wf.id ? null : wf.id))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
