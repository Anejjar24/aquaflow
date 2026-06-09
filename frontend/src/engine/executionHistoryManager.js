/**
 * executionHistoryManager.js
 *
 * Persists per-workflow execution history in localStorage so runs survive
 * page refresh and are immediately available in the Workflow Library.
 *
 * Storage key : "workflow-history:{workflowId}"
 * Max records : 50 per workflow (oldest are evicted automatically)
 * Max output  : 800 chars per value (prevents storage bloat from large payloads)
 *
 * Record shape:
 *   {
 *     id          : string           — unique run identifier
 *     timestamp   : number           — Date.now() at run start
 *     durationMs  : number | null    — wall-clock duration in ms
 *     status      : 'success' | 'failed'
 *     output      : any              — final workflow output (truncated if large)
 *     error       : string | null    — error message on failure
 *     workflowId  : string
 *   }
 */

const HISTORY_PREFIX = 'workflow-history:';
const MAX_RUNS       = 50;
const MAX_OUTPUT_LEN = 800;   // characters; objects JSON-stringified before check

function historyKey(workflowId) {
  return `${HISTORY_PREFIX}${workflowId}`;
}

/**
 * Truncate the output so a single run cannot fill the storage quota.
 * Numbers and booleans are kept as-is (small). Strings and objects are
 * capped at MAX_OUTPUT_LEN characters.
 */
function truncateOutput(output) {
  if (output === null || output === undefined) return null;
  if (typeof output === 'number' || typeof output === 'boolean') return output;

  if (typeof output === 'string') {
    return output.length <= MAX_OUTPUT_LEN ? output : output.slice(0, MAX_OUTPUT_LEN) + '…';
  }

  if (typeof output === 'object') {
    const str = JSON.stringify(output);
    if (str.length <= MAX_OUTPUT_LEN) return output;          // keep as object
    return str.slice(0, MAX_OUTPUT_LEN) + '…';               // fallback to truncated string
  }

  return String(output).slice(0, MAX_OUTPUT_LEN);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prepend a new execution record for the given workflow.
 * Automatically evicts the oldest records beyond MAX_RUNS.
 * No-ops when workflowId is 'new' or absent (unsaved workflows).
 */
export function saveExecutionRecord(workflowId, record) {
  if (!workflowId || workflowId === 'new') return;
  try {
    const existing = loadExecutionHistory(workflowId);
    const truncated = { ...record, output: truncateOutput(record.output) };
    const updated   = [truncated, ...existing].slice(0, MAX_RUNS);
    localStorage.setItem(historyKey(workflowId), JSON.stringify(updated));
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

/**
 * Return the stored execution history for a workflow (newest first).
 * Returns an empty array when no records exist or the id is 'new'.
 */
export function loadExecutionHistory(workflowId) {
  if (!workflowId || workflowId === 'new') return [];
  try {
    const raw = localStorage.getItem(historyKey(workflowId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    localStorage.removeItem(historyKey(workflowId));
    return [];
  }
}

/**
 * Wipe all history records for the given workflow.
 * Called when a workflow is deleted from the library.
 */
export function clearExecutionHistory(workflowId) {
  if (!workflowId) return;
  localStorage.removeItem(historyKey(workflowId));
}
