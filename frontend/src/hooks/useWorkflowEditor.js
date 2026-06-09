import { useCallback, useState } from "react";
import { downloadWorkflowJson } from "engine/graphSerializer";
import { loadWorkflowDraft } from "engine/autosaveManager";
import { saveExecutionRecord } from "engine/executionHistoryManager";
import { executeWorkflowGraph } from "engine/workflowExecutorClient";
import { useAutosave } from "./useAutosave";
import { useExecutionFeedback } from "./useExecutionFeedback";
import { useJointGraph } from "./useJointGraph";

export function useWorkflowEditor() {
  const graph = useJointGraph();
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [editorMessage, setEditorMessage] = useState("");
  const [editingNode, setEditingNode] = useState(null);
  const autosaveStatus = useAutosave(graph.workflow, graph.workflowId);

  // Subscribe to real-time execution events and highlight nodes on the canvas
  // as the backend WorkflowRunner processes them.
  useExecutionFeedback(graph.graphRef, graph.workflowId);

  const exportJson = useCallback(() => {
    const workflow = graph.refreshWorkflow();
    if (workflow) downloadWorkflowJson(workflow);
  }, [graph]);

  const importJsonFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        graph.importWorkflow(JSON.parse(reader.result));
        setEditorMessage("Workflow imported");
      } catch (error) {
        setEditorMessage(error.message);
      }
    };
    reader.readAsText(file);
  }, [graph]);

  const loadAutosave = useCallback(() => {
    const draft = loadWorkflowDraft();
    if (draft) {
      graph.importWorkflow(draft);
      setEditorMessage("Draft restored");
    }
  }, [graph]);

  const execute = useCallback(async () => {
    const workflow = graph.refreshWorkflow();
    if (!workflow) return;

    setIsExecuting(true);
    setExecutionResult(null);
    const startedAt = Date.now();
    try {
      const result = await executeWorkflowGraph(workflow);
      const durationMs = Date.now() - startedAt;
      setExecutionResult({ ...result, startedAt, durationMs });
      setEditorMessage("Execution completed");
      // Persist run record to localStorage for the Workflow Library history view.
      // Only saved (non-'new') workflows have a stable ID to key against.
      saveExecutionRecord(graph.workflowId, {
        id: `${startedAt}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: startedAt,
        durationMs,
        status: 'success',
        output: result.output,
        error: null,
        workflowId: graph.workflowId,
      });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      setExecutionResult({ error: error.message, startedAt, durationMs });
      setEditorMessage("Execution failed");
      saveExecutionRecord(graph.workflowId, {
        id: `${startedAt}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: startedAt,
        durationMs,
        status: 'failed',
        output: null,
        error: error.message,
        workflowId: graph.workflowId,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [graph]);

  return {
    ...graph,
    autosaveStatus,
    executionResult,
    isExecuting,
    editorMessage,
    editingNode,
    setEditingNode,
    exportJson,
    importJsonFile,
    loadAutosave,
    execute,
  };
}
