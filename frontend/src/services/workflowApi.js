import apiClient from './apiClient';

/**
 * Save (create-or-update) a workflow graph with optional trigger settings.
 * The backend upserts on graph.id, so this is safe to call on every autosave.
 *
 * @param {object} workflow  - Raw JointJS workflow graph
 * @param {object} [trigger] - Trigger settings: { triggerType, triggerConfig, isActive }
 */
export function saveWorkflow(workflow, trigger = {}) {
  return apiClient.post('/flows', {
    // trigger.name (set by SaveNameModal / WorkflowSettingsModal) takes priority
    // over the graph-level default so the user's chosen name reaches the backend.
    name: trigger.name || workflow.name || 'Workflow Builder',
    graph: workflow,
    triggerType: trigger.triggerType ?? 'manual',
    triggerConfig: trigger.triggerConfig ?? {},
    isActive: trigger.isActive ?? false,
  }).then((res) => res.data);
}

/**
 * Execute a workflow graph directly (ad-hoc / manual run).
 */
export function executeWorkflow(workflow) {
  return apiClient.post('/flows/execute', {
    graph: workflow,
    input: {},
  }).then((res) => res.data);
}

/**
 * Load all saved workflows (list).
 */
export function loadWorkflows() {
  return apiClient.get('/flows').then((res) => res.data);
}

/**
 * Load a single workflow by ID.
 */
export function loadWorkflow(id) {
  return apiClient.get(`/flows/${id}`).then((res) => res.data);
}

/**
 * Activate a workflow — enables scheduled/MQTT triggers.
 */
export function activateWorkflow(id) {
  return apiClient.patch(`/flows/${id}/activate`).then((res) => res.data);
}

/**
 * Deactivate a workflow — all triggers are paused.
 */
export function deactivateWorkflow(id) {
  return apiClient.patch(`/flows/${id}/deactivate`).then((res) => res.data);
}

/**
 * Fetch the last 50 execution records for a saved workflow.
 * Returns an empty array when the workflow has never been executed.
 */
export function loadExecutions(workflowId) {
  return apiClient.get(`/flows/${workflowId}/executions`).then((res) => res.data);
}

/**
 * Delete a workflow and all its associated execution records.
 */
export function deleteWorkflow(id) {
  return apiClient.delete(`/flows/${id}`).then((res) => res.data);
}
