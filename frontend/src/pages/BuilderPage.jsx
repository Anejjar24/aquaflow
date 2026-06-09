// reactstrap components
import { Badge, Button } from "reactstrap";

// core components
import Header from "components/Headers/Header.js";

import BlockSidebar from "components/Blocksidebar/BlockSidebar";
import FlowCanvas from "components/canvas/FlowCanvas";
import NodeEditorModal from "components/properties/NodeEditorModal";
import PropertiesPanel from "components/properties/PropertiesPanel";
import ExecutionHistoryModal from "components/workflow/ExecutionHistoryModal";
import ExecutionResultPanel from "components/execution/ExecutionResultPanel";
import SaveNameModal from "components/workflow/SaveNameModal";
import WorkflowLibrary from "components/workflow/WorkflowLibrary";
import WorkflowPickerModal from "components/workflow/WorkflowPickerModal";
import WorkflowSettingsModal from "components/workflow/WorkflowSettingsModal";
import {
  clearWorkflowDraft,
  clearTriggerSettings,
  loadTriggerSettings,
  saveWorkflowDraft,
  saveTriggerSettings,
} from "engine/autosaveManager";
import { saveWorkflow } from "services/workflowApi";
import { useWorkflowEditor } from "hooks/useWorkflowEditor";
import { useState } from "react";
import "./workflowBuilder.css";

export default function BuilderPage() {
  const editor = useWorkflowEditor();

  // ─── Trigger / settings state ───────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [libraryOpen, setLibraryOpen]     = useState(false);
  // Lazy initializer: restore the last-saved trigger settings from localStorage
  // so that a page refresh never loses the workflow name, schedule, or active flag.
  // On first render, workflowId is always 'new', so we read the 'new' slot.
  const [triggerSettings, setTriggerSettings] = useState(() => {
    return loadTriggerSettings('new') ?? {
      name: '',
      triggerType: 'manual',
      triggerConfig: {},
      isActive: false,
    };
  });

  // ─── Save — two-step: name modal → persist ──────────────────────────────────
  // Step 1: clicking Save opens the name dialog instead of saving immediately.
  const handleSaveClick = () => setSaveModalOpen(true);

  // Step 2: user confirmed a name — update settings then persist.
  const handleConfirmSave = async (chosenName) => {
    setSaveModalOpen(false);
    // Merge the confirmed name into trigger settings so every downstream
    // call (localStorage, API) uses the same value.
    const settingsWithName = { ...triggerSettings, name: chosenName };
    setTriggerSettings(settingsWithName);

    const workflow = editor.refreshWorkflow();
    if (!workflow) return;
    saveWorkflowDraft(workflow, editor.workflowId);
    // Persist trigger settings (including the new name) alongside the graph.
    saveTriggerSettings(settingsWithName, editor.workflowId);
    try {
      const result = await saveWorkflow(workflow, settingsWithName);
      // First time this workflow is persisted: the backend assigned a real UUID.
      // Migrate localStorage slots from 'new' → real UUID and free the 'new' slots.
      if (editor.workflowId === 'new' && result?.id) {
        clearWorkflowDraft('new');
        clearTriggerSettings('new');
        saveTriggerSettings(settingsWithName, result.id);
        editor.setWorkflowId(result.id);
      }
    } catch {
      // Local save still succeeds when the backend is not running.
    }
  };

  // ─── Load workflow from picker ───────────────────────────────────────────────
  const handleLoadWorkflow = (wf) => {
    // Restore the graph onto the canvas
    if (wf.graph) {
      editor.importWorkflow(wf.graph);
    }
    // Switch the autosave slot to this workflow's real UUID so future drafts
    // and autosaves are isolated to the correct localStorage key.
    if (wf.id) {
      editor.setWorkflowId(wf.id);
    }
    // Prefer any locally-saved trigger settings (e.g. unsaved edits made since
    // the last backend sync), then fall back to the values from the DB record.
    const localSettings = wf.id ? loadTriggerSettings(wf.id) : null;
    const restoredSettings = localSettings ?? {
      name: wf.name || '',
      triggerType: wf.triggerType || 'manual',
      triggerConfig: wf.triggerConfig || {},
      isActive: wf.isActive || false,
    };
    setTriggerSettings(restoredSettings);
    // Ensure settings are persisted under the workflow's own key.
    if (wf.id) saveTriggerSettings(restoredSettings, wf.id);
  };

  // ─── Settings save ──────────────────────────────────────────────────────────
  const handleSettingsSave = async (settings) => {
    setTriggerSettings(settings);
    // Persist immediately so a refresh before the next backend save still
    // restores the new name / trigger type / cron expression / active flag.
    saveTriggerSettings(settings, editor.workflowId);
    const workflow = editor.refreshWorkflow();
    if (workflow) {
      saveWorkflowDraft(workflow, editor.workflowId);
      try {
        await saveWorkflow(workflow, settings);
      } catch {
        // Offline — will sync next time
      }
    }
  };

  // ─── Derived display ────────────────────────────────────────────────────────
  const triggerLabel =
    triggerSettings.triggerType === 'scheduled'
      ? `⏱ ${triggerSettings.triggerConfig?.cron || 'no cron'}`
      : triggerSettings.triggerType === 'sensor_threshold'
      ? `📡 threshold`
      : 'manual';

  return (
    <div className="builder-page-root">
      {/* ── Argon-style header (provides the gradient background) ── */}
      <Header />

      {/* ── Full-page builder shell — sits in the mt--7 negative-margin zone ── */}
      <div className="builder-shell mt--7">

        {/* ── Workflow toolbar (always visible, above the 3-panel grid) ── */}
        <div className="builder-toolbar">
          <Button
            size="sm"
            color="primary"
            onClick={handleSaveClick}
            title="Save workflow to backend"
          >
            <i className="fa fa-save mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={() => setPickerOpen(true)}
            title="Load a saved workflow"
          >
            <i className="fa fa-folder-open mr-1" />
            Load
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={() => setSettingsOpen(true)}
            title="Workflow trigger settings"
          >
            <i className="ni ni-settings mr-1" />
            Settings
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={() => setHistoryOpen(true)}
            title={editor.workflowId === 'new' ? 'Save the workflow to view history' : 'Execution history'}
            disabled={editor.workflowId === 'new'}
          >
            <i className="ni ni-bullet-list-67 mr-1" />
            History
          </Button>
          <Button
            size="sm"
            color="secondary"
            onClick={() => setLibraryOpen(true)}
            title="Open Workflow Library"
          >
            <i className="ni ni-collection mr-1" />
            Library
          </Button>
          {/* Workflow name — shown after the first save */}
          {triggerSettings.name && (
            <span className="builder-workflow-name" title="Workflow name">
              <i className="fa fa-circle" style={{ fontSize: 5, marginRight: 6, verticalAlign: 'middle', color: '#94a3b8' }} />
              {triggerSettings.name}
            </span>
          )}

          <Badge
            color={triggerSettings.isActive ? 'success' : 'secondary'}
            className="text-xs"
            title={`Trigger: ${triggerSettings.triggerType}`}
          >
            {triggerLabel}
          </Badge>
          {triggerSettings.isActive && (
            <Badge color="success" className="text-xs">Active</Badge>
          )}
        </div>

        {/* ── 3-panel editor area ── */}
        <main className="workflow-builder">
          <BlockSidebar />
          <FlowCanvas editor={editor} />
          <PropertiesPanel editor={editor} />
          <NodeEditorModal
            node={editor.editingNode}
            onClose={() => editor.setEditingNode(null)}
            onSave={editor.updateSelectedNode}
          />
          {editor.editorMessage && (
            <div className="workflow-toast">{editor.editorMessage}</div>
          )}
        </main>

        {/* ── Execution result panel (full-width, below the 3-panel grid) ── */}
        <ExecutionResultPanel
          result={editor.executionResult}
          isRunning={editor.isExecuting}
        />
      </div>

      {/* ── Workflow Library ── */}
      <WorkflowLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onOpen={handleLoadWorkflow}
      />

      {/* ── Save Name Modal ── */}
      <SaveNameModal
        isOpen={saveModalOpen}
        initial={triggerSettings.name}
        onSave={handleConfirmSave}
        onClose={() => setSaveModalOpen(false)}
      />

      {/* ── Workflow Settings Modal ── */}
      <WorkflowSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSettingsSave}
        initial={triggerSettings}
      />

      {/* ── Workflow Picker Modal ── */}
      <WorkflowPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleLoadWorkflow}
      />

      {/* ── Execution History Modal ── */}
      <ExecutionHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        workflowId={editor.workflowId}
      />
    </div>
  );
}