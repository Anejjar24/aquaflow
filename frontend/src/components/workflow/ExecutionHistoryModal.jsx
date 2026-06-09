import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from 'reactstrap';
import { loadExecutions } from 'services/workflowApi';

/**
 * ExecutionHistoryModal
 *
 * Displays the last 50 execution records for the currently-loaded workflow.
 * Each row is expandable to show the per-node step log (nodeId, type, input,
 * output) stored in the WorkflowExecution.executionLog JSONB column.
 *
 * Props:
 *   isOpen      {boolean}
 *   onClose     {() => void}
 *   workflowId  {string}  — 'new' means unsaved; panel shows a hint instead
 */

// Maps WorkflowExecutionStatus enum values to Reactstrap Badge colours.
const STATUS_COLOUR = {
  completed: 'success',
  failed:    'danger',
  running:   'warning',
  cancelled: 'secondary',
  paused:    'info',
};

function formatDuration(ms) {
  if (ms == null || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

export default function ExecutionHistoryModal({ isOpen, onClose, workflowId }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const isSaved = workflowId && workflowId !== 'new';

  // Re-fetch every time the modal is opened (or the workflow changes).
  useEffect(() => {
    if (!isOpen || !isSaved) return;
    setLoading(true);
    setError(null);
    setExpandedId(null);
    loadExecutions(workflowId)
      .then(setExecutions)
      .catch(() => setError('Could not load execution history. Is the backend running?'))
      .finally(() => setLoading(false));
  }, [isOpen, workflowId, isSaved]);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="xl" scrollable>
      <ModalHeader toggle={onClose}>
        <i className="ni ni-bullet-list-67 mr-2" />
        Execution History
        {executions.length > 0 && (
          <Badge color="secondary" className="ml-2" pill>
            {executions.length}
          </Badge>
        )}
      </ModalHeader>

      <ModalBody className="p-0">

        {/* ── Unsaved workflow hint ── */}
        {!isSaved && (
          <p className="text-muted text-center py-5 mb-0">
            Save the workflow first to view its execution history.
          </p>
        )}

        {/* ── Loading ── */}
        {isSaved && loading && (
          <div className="text-center py-5">
            <Spinner color="primary" />
            <p className="mt-2 mb-0 text-muted small">Loading history…</p>
          </div>
        )}

        {/* ── Error ── */}
        {isSaved && !loading && error && (
          <div className="alert alert-danger m-3 mb-0">{error}</div>
        )}

        {/* ── Empty ── */}
        {isSaved && !loading && !error && executions.length === 0 && (
          <p className="text-muted text-center py-5 mb-0">
            No executions recorded yet — click <strong>Run</strong> to create the first one.
          </p>
        )}

        {/* ── Execution list ── */}
        {isSaved && !loading && !error && executions.length > 0 && (
          <div className="exec-history-list">
            {executions.map((ex) => {
              const isExpanded = expandedId === ex.id;
              const hasSteps   = Array.isArray(ex.executionLog) && ex.executionLog.length > 0;

              return (
                <div key={ex.id} className="exec-history-row">

                  {/* Summary / toggle button */}
                  <button
                    className="exec-history-summary"
                    onClick={() => toggleExpand(ex.id)}
                    type="button"
                    aria-expanded={isExpanded}
                  >
                    <Badge
                      color={STATUS_COLOUR[ex.status] || 'secondary'}
                      className="exec-status-badge"
                    >
                      {ex.status}
                    </Badge>

                    <span className="exec-time">{formatDate(ex.startedAt)}</span>

                    <span className="exec-meta">
                      <i className="fa fa-clock mr-1" aria-hidden="true" />
                      {formatDuration(ex.duration)}
                    </span>

                    <span className="exec-meta">
                      <i className="fa fa-sitemap mr-1" aria-hidden="true" />
                      {ex.nodeExecutionCount} node{ex.nodeExecutionCount !== 1 ? 's' : ''}
                    </span>

                    <Badge color="light" className="exec-trigger-badge">
                      {ex.triggerSource || 'manual'}
                    </Badge>

                    <i
                      className={`fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} exec-chevron`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Error message (visible without expanding) */}
                  {ex.errorMessage && (
                    <div className="exec-error-msg">
                      <i className="fa fa-exclamation-triangle mr-1" aria-hidden="true" />
                      {ex.errorMessage}
                    </div>
                  )}

                  {/* Expanded step-by-step log */}
                  {isExpanded && (
                    <div className="exec-step-log">
                      {hasSteps ? (
                        <table className="exec-step-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Node ID</th>
                              <th>Type</th>
                              <th>Input</th>
                              <th>Output</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ex.executionLog.map((step, i) => (
                              <tr key={i}>
                                <td className="exec-step-num">{i + 1}</td>
                                <td className="exec-step-id">{step.nodeId}</td>
                                <td>
                                  <Badge color="light">{step.type}</Badge>
                                </td>
                                <td className="exec-step-value">
                                  <pre>{JSON.stringify(step.input, null, 2)}</pre>
                                </td>
                                <td className="exec-step-value">
                                  <pre>{JSON.stringify(step.output, null, 2)}</pre>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-muted small mb-0">No step log available for this run.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button color="secondary" onClick={onClose} type="button">
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
