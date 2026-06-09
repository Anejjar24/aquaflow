import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { selectAccessToken } from 'store/slices/authSlice';

/**
 * useExecutionFeedback
 *
 * Opens a dedicated Socket.IO connection and listens for workflow execution
 * events emitted by the backend WorkflowRunner.  As each node executes, its
 * JointJS cell is highlighted on the canvas:
 *
 *   workflow:node-executing  → amber stroke  (node is actively running)
 *   workflow:node-executed   → green stroke  (status === 'success')
 *                            → red stroke    (status === 'error')
 *   workflow:completed       → all strokes reset after a brief pause
 *   workflow:failed          → kept red; other nodes reset
 *
 * The hook filters events so only nodes belonging to the currently-loaded
 * workflow are highlighted (events for other workflows are ignored).
 *
 * @param {React.MutableRefObject} graphRef   - ref to the live dia.Graph
 * @param {string}                 workflowId - current workflow UUID or 'new'
 */

const SOCKET_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';

const STROKE = {
  running: '#d97706',  // amber-600  — node is executing
  success: '#16a34a',  // green-600  — node completed OK
  error:   '#dc2626',  // red-600    — node threw an error
};

/** Apply a coloured stroke to a JointJS cell, then reset it after `delay` ms. */
function applyStroke(cell, colour, strokeWidth, delay, timers) {
  const nodeId = cell.id;

  // Cancel any pending reset for this node so rapid events don't conflict.
  if (timers.has(nodeId)) clearTimeout(timers.get(nodeId));

  cell.attr('body/stroke', colour);
  cell.attr('body/strokeWidth', strokeWidth);

  if (delay > 0) {
    const t = setTimeout(() => {
      // Restore the block's design-system colour and default stroke width.
      const originalColor = cell.get('workflow')?.color || '#64748b';
      cell.attr('body/stroke', originalColor);
      cell.attr('body/strokeWidth', 2);
      timers.delete(nodeId);
    }, delay);
    timers.set(nodeId, t);
  }
}

/** Reset all cells in the graph to their original stroke colours. */
function resetAllStrokes(graph, delay, timers) {
  setTimeout(() => {
    if (!graph) return;
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    graph.getElements().forEach((cell) => {
      const originalColor = cell.get('workflow')?.color || '#64748b';
      cell.attr('body/stroke', originalColor);
      cell.attr('body/strokeWidth', 2);
    });
  }, delay);
}

export function useExecutionFeedback(graphRef, workflowId) {
  const token = useSelector(selectAccessToken);
  // Keep a stable ref to `workflowId` so the event handler closure always sees
  // the current value without recreating the socket on every render.
  const workflowIdRef = useRef(workflowId);
  workflowIdRef.current = workflowId;

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    // nodeId → pending-reset timer id
    const timers = new Map();

    // ── Helper: find a cell in the live graph by its workflow node id ────────
    const getCell = (nodeId) => {
      const graph = graphRef.current;
      if (!graph) return null;
      return graph.getCell(nodeId) ?? null;
    };

    // ── Filter: ignore events from other workflows ────────────────────────────
    const isCurrentWorkflow = (eventWorkflowId) => {
      const currentId = workflowIdRef.current;
      // Always show events when the current draft is unsaved ('new') — ad-hoc runs
      // don't have a workflowId in the graph, so we can't filter by it.
      if (!currentId || currentId === 'new') return true;
      if (!eventWorkflowId) return true;
      return eventWorkflowId === currentId;
    };

    // ── Event: a node is about to execute (highlight amber) ──────────────────
    socket.on('workflow:node-executing', ({ workflowId: wid, nodeId }) => {
      if (!isCurrentWorkflow(wid)) return;
      const cell = getCell(nodeId);
      if (cell) applyStroke(cell, STROKE.running, 3, 0, timers); // 0 = no auto-reset
    });

    // ── Event: a node has finished executing ─────────────────────────────────
    socket.on('workflow:node-executed', ({ workflowId: wid, nodeId, status }) => {
      if (!isCurrentWorkflow(wid)) return;
      const cell = getCell(nodeId);
      if (!cell) return;
      const colour = STROKE[status] || STROKE.success;
      // Green/red flash: hold for 1.5 s then fade back to original
      applyStroke(cell, colour, 3, 1500, timers);
    });

    // ── Event: entire workflow finished successfully ──────────────────────────
    socket.on('workflow:completed', ({ workflowId: wid }) => {
      if (!isCurrentWorkflow(wid)) return;
      resetAllStrokes(graphRef.current, 2000, timers);
    });

    // ── Event: workflow run failed (unhandled exception) ─────────────────────
    socket.on('workflow:failed', ({ workflowId: wid }) => {
      if (!isCurrentWorkflow(wid)) return;
      // Leave the red node as-is; reset everything else after 3 s
      setTimeout(() => {
        const graph = graphRef.current;
        if (!graph) return;
        graph.getElements().forEach((cell) => {
          const currentStroke = cell.attr('body/stroke');
          if (currentStroke !== STROKE.error) {
            const originalColor = cell.get('workflow')?.color || '#64748b';
            cell.attr('body/stroke', originalColor);
            cell.attr('body/strokeWidth', 2);
          }
        });
      }, 3000);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      socket.disconnect();
    };
  }, [token, graphRef]); // workflowId deliberately omitted — tracked via ref
}
