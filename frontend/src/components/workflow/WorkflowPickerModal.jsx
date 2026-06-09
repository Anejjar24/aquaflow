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
import { loadWorkflows } from 'services/workflowApi';

/**
 * WorkflowPickerModal
 *
 * Fetches saved workflows from the backend and lets the user pick one to load
 * into the builder canvas.
 *
 * Props:
 *   isOpen   {boolean}
 *   onClose  {() => void}
 *   onSelect {(workflow: object) => void}  — receives the full workflow entity
 *                                            (including .graph, .triggerType, etc.)
 */
export default function WorkflowPickerModal({ isOpen, onClose, onSelect }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch the workflow list every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    loadWorkflows()
      .then(setWorkflows)
      .catch(() => setError('Could not load workflows. Is the backend running?'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSelect = (wf) => {
    onSelect(wf);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="lg" scrollable>
      <ModalHeader toggle={onClose}>
        <i className="ni ni-collection mr-2" />
        Load Workflow
      </ModalHeader>

      <ModalBody>
        {/* ── Loading ── */}
        {loading && (
          <div className="text-center py-4">
            <Spinner color="primary" />
            <p className="mt-2 mb-0 text-muted small">Loading workflows…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="alert alert-danger mb-0">{error}</div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && workflows.length === 0 && (
          <p className="text-muted text-center py-4 mb-0">
            No saved workflows yet. Build one and click <strong>Save</strong>!
          </p>
        )}

        {/* ── Workflow list ── */}
        {!loading && !error && workflows.length > 0 && (
          <div className="workflow-picker-list">
            {workflows.map((wf) => {
              const nodeCount = wf.graph?.nodes?.length ?? 0;
              const savedDate = new Date(wf.updatedAt || wf.createdAt).toLocaleDateString();

              return (
                <button
                  key={wf.id}
                  className="workflow-picker-item"
                  onClick={() => handleSelect(wf)}
                  type="button"
                >
                  <div className="wf-picker-icon">
                    <i className="ni ni-collection" />
                  </div>

                  <div className="wf-picker-info">
                    <strong className="wf-picker-name">{wf.name}</strong>
                    <small className="text-muted">
                      {nodeCount} node{nodeCount !== 1 ? 's' : ''} · saved {savedDate}
                    </small>
                  </div>

                  <div className="wf-picker-badges">
                    <Badge
                      color={wf.isActive ? 'success' : 'secondary'}
                      pill
                    >
                      {wf.triggerType}
                    </Badge>
                    {wf.executionCount > 0 && (
                      <Badge color="info" pill>
                        {wf.executionCount} run{wf.executionCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button color="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
