import { useCallback, useRef, useState } from "react";
import { dia, shapes } from "@joint/core";
import {
  createWorkflowLink,
  createWorkflowNode,
  updateNodeProperties,
} from "registry/blockFactory";
import { deserializeGraph } from "engine/graphDeserializer";
import { serializeGraph } from "engine/graphSerializer";

// ─────────────────────────────────────────────────────────────────────────────
// UndoRedoManager
//
// dia.CommandManager is a @joint/plus (paid add-on) feature that is NOT
// available in the free @joint/core package.  This class provides equivalent
// undo/redo behaviour using full serialised graph snapshots.
//
// Stack layout:   [snap0, snap1, snap2 …]
//                                    ↑ _cursor  (currently displayed state)
//
//   push()   — append a new snapshot, discard any redo branch
//   undo()   — cursor--, return snap to restore
//   redo()   — cursor++, return snap to restore
//   reset()  — wipe history, optionally seed with a baseline snapshot so
//              the user cannot undo past an explicit load/import point
//   pause() / resume() — suppress pushes during programmatic graph
//              restoration so deserialisation events don't pollute the stack
// ─────────────────────────────────────────────────────────────────────────────
class UndoRedoManager {
  constructor() {
    this._stack = [];
    this._cursor = -1;
    this._paused = false;
    this._debounceTimer = null;
  }

  /** Push a snapshot immediately, discarding any redo branch. */
  push(snapshot) {
    if (this._paused) return;
    this._stack.splice(this._cursor + 1);
    this._stack.push(snapshot);
    this._cursor = this._stack.length - 1;
  }

  /**
   * Debounced push — called for position-change events so dragging a node
   * produces one stack entry rather than hundreds.
   * @param {object}   snapshot
   * @param {number}   delay     - milliseconds to wait before committing
   * @param {Function} [onPushed] - optional callback fired after commit
   */
  pushDebounced(snapshot, delay, onPushed) {
    if (this._paused) return;
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this.push(snapshot);
      onPushed?.();
    }, delay);
  }

  /** Commit any in-flight debounced snapshot right now (e.g. before undo/redo). */
  flushDebounce() {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }

  hasUndo() { return this._cursor > 0; }
  hasRedo() { return this._cursor < this._stack.length - 1; }

  /** Decrement cursor and return the snapshot to restore, or null. */
  undo() {
    if (!this.hasUndo()) return null;
    this._cursor -= 1;
    return this._stack[this._cursor];
  }

  /** Increment cursor and return the snapshot to restore, or null. */
  redo() {
    if (!this.hasRedo()) return null;
    this._cursor += 1;
    return this._stack[this._cursor];
  }

  /**
   * Wipe history and optionally seed a new baseline.
   * Called after import / load so undo cannot reach back past that point.
   */
  reset(initialSnapshot) {
    this.flushDebounce();
    if (initialSnapshot != null) {
      this._stack = [initialSnapshot];
      this._cursor = 0;
    } else {
      this._stack = [];
      this._cursor = -1;
    }
  }

  /** Prevent snapshot pushes while the graph is being rebuilt programmatically. */
  pause()  { this._paused = true;  }
  resume() { this._paused = false; }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useJointGraph() {
  const graphRef = useRef(null);
  const paperRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [zoom, setZoom] = useState(1);

  // ── Workflow identity ──────────────────────────────────────────────────────
  // 'new' = unsaved draft.  Promoted to the backend UUID after first successful
  // save, or set to a loaded workflow's UUID via setWorkflowId().
  // A ref keeps the value available inside closures (refreshWorkflow) without
  // needing it as a dependency; the state copy triggers re-renders for consumers.
  const workflowIdRef = useRef('new');
  const [workflowId, setWorkflowIdState] = useState('new');

  const setWorkflowId = useCallback((id) => {
    workflowIdRef.current = id;
    setWorkflowIdState(id);
  }, []);

  // ── History (undo / redo) ──────────────────────────────────────────────────
  const undoRedoRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const refreshWorkflow = useCallback(() => {
    if (!graphRef.current) return null;
    const nextWorkflow = serializeGraph(graphRef.current, workflowIdRef.current);
    setWorkflow(nextWorkflow);
    return nextWorkflow;
  }, []);

  const initialize = useCallback(
    (element, options = {}) => {
      // Read the real pixel size at mount time so JointJS never starts at 0×0.
      // The ResizeObserver in JointPaper.jsx keeps this updated afterward.
      const initWidth = element.offsetWidth || element.clientWidth || 800;
      const initHeight = element.offsetHeight || element.clientHeight || 600;

      const graph = new dia.Graph({}, { cellNamespace: shapes });
      const paper = new dia.Paper({
        el: element,
        model: graph,
        // Use concrete pixel dimensions, not "100%"
        width: initWidth,
        height: initHeight,
        gridSize: 20,
        drawGrid: { name: "mesh", args: { color: "#d9e2ec", thickness: 1 } },
        background: { color: "#f8fafc" },
        cellViewNamespace: shapes,
        sorting: dia.Paper.sorting.APPROX,
        defaultLink: () => createWorkflowLink({}, {}),
        defaultConnector: { name: "rounded" },
        defaultRouter: { name: "manhattan" },
        linkPinning: false,
        validateConnection: (
          sourceView,
          sourceMagnet,
          targetView,
          targetMagnet
        ) => {
          // Basic guards: both magnets must exist, and self-loops are forbidden.
          if (!sourceMagnet || !targetMagnet || sourceView === targetView)
            return false;

          // Direction rule: only output → input connections are allowed.
          if (
            sourceMagnet.getAttribute("port-group") !== "output" ||
            targetMagnet.getAttribute("port-group") !== "input"
          ) return false;

          // One-incoming-edge-per-input-port rule.
          // Scan existing links to see whether the target port is already occupied.
          // This prevents ambiguous "which value wins?" situations at execution time.
          const targetPortId = targetMagnet.getAttribute("port");
          const targetCellId = String(targetView.model.id);
          const alreadyOccupied = graph.getLinks().some((link) => {
            const t = link.target();
            return String(t.id) === targetCellId && t.port === targetPortId;
          });
          return !alreadyOccupied;
        },
        interactive: { linkMove: false },
        markAvailable: true,
      });

      graphRef.current = graph;
      paperRef.current = paper;

      // ── Snapshot-based undo/redo ───────────────────────────────────────────
      // Replaces dia.CommandManager (which is @joint/plus / paid-only).
      // We store full serialised workflow objects as history snapshots.
      const ur = new UndoRedoManager();
      undoRedoRef.current = ur;

      // Capture the initial empty-canvas state as the baseline so that even
      // the very first node addition can be undone.
      const initialSnap = serializeGraph(graph, workflowIdRef.current);
      ur.reset(initialSnap);

      // ── Graph event listeners ──────────────────────────────────────────────
      // Structural mutations (add/remove/link rewire/custom-data change):
      //   → push a snapshot immediately.
      // Position changes (node drag):
      //   → push debounced (200 ms) to avoid flooding the stack with every
      //     pixel of movement.
      //
      // Both listeners are guarded by `ur._paused` so that programmatic
      // restoration (undo / redo / importWorkflow) does not recurse.

      graph.on("add remove change:target change:source change:workflow", () => {
        if (ur._paused) return;
        const snap = refreshWorkflow();
        if (snap) {
          ur.push(snap);
          setCanUndo(ur.hasUndo());
          setCanRedo(ur.hasRedo());
        }
      });

      graph.on("change:position", () => {
        if (ur._paused) return;
        const snap = refreshWorkflow();
        if (snap) {
          ur.pushDebounced(snap, 200, () => {
            setCanUndo(ur.hasUndo());
            setCanRedo(ur.hasRedo());
          });
        }
      });

      paper.on("element:pointerclick", (elementView) =>
        setSelectedNode(elementView.model)
      );
      paper.on("element:pointerdblclick", (elementView) =>
        options.onEdit?.(elementView.model)
      );
      paper.on("blank:pointerclick", () => setSelectedNode(null));

      return () => {
        if (undoRedoRef.current) {
          undoRedoRef.current.reset();
          undoRedoRef.current = null;
        }
        paper.remove();
        graph.clear();
        graphRef.current = null;
        paperRef.current = null;
      };
    },
    [refreshWorkflow]
  );

  const addNode = useCallback(
    (type, position) => {
      const node = createWorkflowNode(type, position);
      node.addTo(graphRef.current);
      setSelectedNode(node);
      refreshWorkflow();
    },
    [refreshWorkflow]
  );

  const updateSelectedNode = useCallback(
    (properties) => {
      if (!selectedNode) return;
      updateNodeProperties(selectedNode, properties);
      setSelectedNode(selectedNode);
      refreshWorkflow();
    },
    [refreshWorkflow, selectedNode]
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    selectedNode.remove();
    setSelectedNode(null);
    refreshWorkflow();
  }, [refreshWorkflow, selectedNode]);

  const duplicateSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const workflowData = selectedNode.get("workflow");
    const position = selectedNode.position();
    const node = createWorkflowNode(
      workflowData.type,
      { x: position.x + 36, y: position.y + 36 },
      { data: { ...(workflowData.data || {}) } }
    );
    node.addTo(graphRef.current);
    setSelectedNode(node);
    refreshWorkflow();
  }, [refreshWorkflow, selectedNode]);

  const importWorkflow = useCallback(
    (nextWorkflow) => {
      const ur = undoRedoRef.current;
      // Pause history so the graph.clear() + per-node add events fired by
      // deserializeGraph don't generate spurious undo entries.
      if (ur) { ur.flushDebounce(); ur.pause(); }
      deserializeGraph(graphRef.current, nextWorkflow);
      if (ur) ur.resume();

      setSelectedNode(null);
      const snap = refreshWorkflow();

      // Reset history with the imported state as the new baseline.
      // The user cannot undo back past this load point.
      if (ur && snap) {
        ur.reset(snap);
        setCanUndo(false);
        setCanRedo(false);
      }
    },
    [refreshWorkflow]
  );

  const undo = useCallback(() => {
    const ur = undoRedoRef.current;
    if (!ur?.hasUndo()) return;
    // Commit any in-flight debounced position snapshot before we travel back.
    ur.flushDebounce();
    const snapshot = ur.undo();
    if (!snapshot) return;
    // Pause so deserialisation events don't push new entries onto the stack.
    ur.pause();
    deserializeGraph(graphRef.current, snapshot);
    ur.resume();
    setSelectedNode(null);
    setCanUndo(ur.hasUndo());
    setCanRedo(ur.hasRedo());
    refreshWorkflow();
  }, [refreshWorkflow]);

  const redo = useCallback(() => {
    const ur = undoRedoRef.current;
    if (!ur?.hasRedo()) return;
    ur.flushDebounce();
    const snapshot = ur.redo();
    if (!snapshot) return;
    ur.pause();
    deserializeGraph(graphRef.current, snapshot);
    ur.resume();
    setSelectedNode(null);
    setCanUndo(ur.hasUndo());
    setCanRedo(ur.hasRedo());
    refreshWorkflow();
  }, [refreshWorkflow]);

  const setPaperZoom = useCallback((nextZoom) => {
    const value = Math.min(1.8, Math.max(0.45, nextZoom));
    paperRef.current.scale(value);
    setZoom(value);
  }, []);

  const resetView = useCallback(() => {
    paperRef.current.scale(1);
    paperRef.current.translate(0, 0);
    setZoom(1);
  }, []);

  /**
   * Scale and translate the paper so all nodes are visible and centred.
   *
   * Uses JointJS's built-in `scaleContentToFit` which adjusts the paper's
   * current translate + scale without resizing the DOM element.  After the
   * call, the zoom state is read back from the paper so the toolbar readout
   * stays in sync.
   */
  const fitToScreen = useCallback(() => {
    const paper = paperRef.current;
    if (!paper) return;
    paper.scaleContentToFit({
      padding: 40,          // breathing room around the outermost nodes
      minScale: 0.2,        // never shrink below 20 %
      maxScale: 2.0,        // never expand beyond 200 %
      useModelGeometry: false, // use rendered bounding boxes for accuracy
    });
    // Read back the actual scale JointJS chose and sync React state.
    setZoom(paper.scale().sx);
  }, []);

  return {
    graphRef,
    paperRef,
    selectedNode,
    workflow,
    workflowId,
    setWorkflowId,
    canUndo,
    canRedo,
    zoom,
    initialize,
    addNode,
    updateSelectedNode,
    deleteSelectedNode,
    duplicateSelectedNode,
    importWorkflow,
    undo,
    redo,
    refreshWorkflow,
    setPaperZoom,
    resetView,
    fitToScreen,
  };
}
