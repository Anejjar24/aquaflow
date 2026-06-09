import { useEffect, useRef } from "react";
import { loadWorkflowDraft } from "engine/autosaveManager";
import CanvasToolbar from "./CanvasToolbar";
import JointPaper from "./JointPaper";

const starterWorkflow = {
  nodes: [
    { id: "input-1", type: "input", position: { x: 80, y: 120 }, data: { label: "Input", value: "10" } },
    { id: "action-1", type: "action", position: { x: 360, y: 120 }, data: { label: "Multiply", operation: "multiply", factor: 2 } },
    { id: "output-1", type: "output", position: { x: 650, y: 120 }, data: { label: "Output", format: "json" } },
  ],
  edges: [
    { source: "input-1", sourcePort: "out", target: "action-1", targetPort: "in" },
    { source: "action-1", sourcePort: "out", target: "output-1", targetPort: "in" },
  ],
};

export default function FlowCanvas({ editor }) {
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const currentEditor = editorRef.current;
      if (!currentEditor.graphRef.current || currentEditor.workflow?.nodes?.length) return;
      // Load the draft for the currently active workflow ID.
      // For a fresh session this is 'new', which transparently falls back to the
      // legacy "workflow-builder-autosave" key for backward compatibility.
      const draft = loadWorkflowDraft(currentEditor.workflowId || 'new');
      // importWorkflow resets undo/redo history so undo can't reach past
      // this baseline, and it also clears the node selection.
      currentEditor.importWorkflow(draft || starterWorkflow);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section className="workflow-canvas-panel">
      <CanvasToolbar
        autosaveStatus={editor.autosaveStatus}
        isExecuting={editor.isExecuting}
        onDelete={editor.deleteSelectedNode}
        onDuplicate={editor.duplicateSelectedNode}
        onExecute={editor.execute}
        onExport={editor.exportJson}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onFit={editor.fitToScreen}
        onImport={editor.importJsonFile}
        onRedo={editor.redo}
        onReset={editor.resetView}
        onUndo={editor.undo}
        onZoomIn={() => editor.setPaperZoom(editor.zoom + 0.1)}
        onZoomOut={() => editor.setPaperZoom(editor.zoom - 0.1)}
        selectedNode={editor.selectedNode}
        zoom={editor.zoom}
      />
      <JointPaper editor={editor} />
    </section>
  );
}
