/**
 * autosaveManager.js
 *
 * Persists workflow drafts AND trigger settings in localStorage with per-workflow keys.
 *
 * Graph draft key    : "workflow-draft:{id}"
 * Trigger-settings key : "workflow-trigger:{id}"
 * Default id          : "new"  (unsaved workflow; promoted to real UUID after first save)
 *
 * Backward compat: the legacy single key "workflow-builder-autosave" is read as a
 * fall-through when id === "new" so that drafts saved before this change are
 * transparently migrated on the next autosave cycle.
 */

const PREFIX = 'workflow-draft:';
const LEGACY_KEY = 'workflow-builder-autosave';

const draftKey = (id) => `${PREFIX}${id}`;

// ─── Trigger settings ────────────────────────────────────────────────────────

const TRIGGER_PREFIX = 'workflow-trigger:';
const triggerKey = (id) => `${TRIGGER_PREFIX}${id}`;

/**
 * Persist triggerSettings (name, triggerType, triggerConfig, isActive) so they
 * survive a page refresh.  Called from BuilderPage whenever settings change.
 */
export function saveTriggerSettings(settings, id = 'new') {
  try {
    localStorage.setItem(triggerKey(id), JSON.stringify(settings));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
}

/**
 * Restore previously-persisted triggerSettings.
 * Returns null when no saved settings exist for this id.
 */
export function loadTriggerSettings(id = 'new') {
  try {
    const raw = localStorage.getItem(triggerKey(id));
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(triggerKey(id));
  }
  return null;
}

/**
 * Remove the trigger-settings slot for the given workflow id.
 * Called when a workflow transitions from 'new' → real UUID so the 'new' slot
 * doesn't accumulate stale data.
 */
export function clearTriggerSettings(id = 'new') {
  localStorage.removeItem(triggerKey(id));
}

// ─── Save ────────────────────────────────────────────────────────────────────

export function saveWorkflowDraft(workflow, id = 'new') {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(workflow));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
}

// ─── Load ────────────────────────────────────────────────────────────────────

export function loadWorkflowDraft(id = 'new') {
  // 1. Try the keyed slot first
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(draftKey(id));
  }

  // 2. Backward compat: fall back to the legacy single key only for the 'new' slot
  if (id === 'new') {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      localStorage.removeItem(LEGACY_KEY);
    }
  }

  return null;
}

// ─── Clear ───────────────────────────────────────────────────────────────────

export function clearWorkflowDraft(id = 'new') {
  localStorage.removeItem(draftKey(id));
  // Also wipe the legacy key when clearing the 'new' slot
  if (id === 'new') {
    localStorage.removeItem(LEGACY_KEY);
  }
}
