import { useEffect, useRef, useState } from "react";
import { saveWorkflowDraft } from "engine/autosaveManager";

/**
 * Debounced autosave hook.
 *
 * @param {object} workflow - Serialized workflow snapshot (from useJointGraph).
 * @param {string} [id]     - Workflow identity key used for localStorage slot.
 *                            Defaults to 'new' (unsaved draft).
 * @param {boolean} [enabled]
 */
export function useAutosave(workflow, id = 'new', enabled = true) {
  const [status, setStatus] = useState("Idle");
  const lastSavedRef = useRef("");

  useEffect(() => {
    if (!enabled || !workflow) return undefined;

    const serialized = JSON.stringify(workflow);
    if (serialized === lastSavedRef.current) return undefined;

    setStatus("Saving");
    const timeout = window.setTimeout(() => {
      saveWorkflowDraft(workflow, id);
      lastSavedRef.current = serialized;
      setStatus(`Saved ${new Date().toLocaleTimeString()}`);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [workflow, id, enabled]);

  return status;
}
