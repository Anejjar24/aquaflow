import { useEffect, useRef, useState } from "react";
import "jointjs/dist/joint.css";
import { getCanvasDropPoint } from "utils/graphHelpers";

export default function JointPaper({ editor }) {
  const paperElementRef = useRef(null);
  const editorRef = useRef(editor);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef(null);

  editorRef.current = editor;

  // ── 1. Initialize JointJS paper ──────────────────────────────────────────
  useEffect(() => {
    if (!paperElementRef.current) return undefined;

    const cleanup = editorRef.current.initialize(paperElementRef.current, {
      onEdit: editorRef.current.setEditingNode,
    });

    // JointJS reads the container size synchronously during init.
    // At that moment the CSS grid may not have finished layout yet,
    // so we force a re-measure on the next animation frame after paint.
    const rafId = requestAnimationFrame(() => {
      const paper = editorRef.current.paperRef.current;
      const el = paperElementRef.current;
      if (!paper || !el) return;
      paper.setDimensions(el.offsetWidth, el.offsetHeight);
    });

    return () => {
      cancelAnimationFrame(rafId);
      cleanup?.();
    };
  }, []);

  // ── 2. Keep paper dimensions in sync when the container is resized ───────
  useEffect(() => {
    const el = paperElementRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const paper = editorRef.current.paperRef.current;
      if (!paper) return;
      const entry = entries[0];
      // contentBoxSize is the most accurate; fall back to clientWidth/Height
      const width =
        entry.contentBoxSize?.[0]?.inlineSize ?? el.clientWidth;
      const height =
        entry.contentBoxSize?.[0]?.blockSize ?? el.clientHeight;
      if (width > 0 && height > 0) {
        paper.setDimensions(width, height);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 3. Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.target?.tagName === "INPUT" ||
        event.target?.tagName === "TEXTAREA"
      )
        return;

      if (event.key === "Delete" || event.key === "Backspace") {
        editorRef.current.deleteSelectedNode();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        editorRef.current.duplicateSelectedNode();
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        editorRef.current.undo();
      }

      // Redo: Ctrl+Y / Cmd+Y  —OR—  Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z")
      ) {
        event.preventDefault();
        editorRef.current.redo();
      }

      // Fit to screen: Ctrl+Shift+F / Cmd+Shift+F
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        editorRef.current.fitToScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── 4. Drop handler ───────────────────────────────────────────────────────
  const handleDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/workflow-block");
    if (!type || !editor.paperRef.current) return;

    // clientToLocalPoint handles translation + scale — pass raw client coords.
    const point = getCanvasDropPoint(event, editor.paperRef.current);
    editor.addNode(type, { x: point.x, y: point.y });
  };

  // ── 5. Middle-mouse / Alt+drag panning ───────────────────────────────────
  const handleMouseDown = (event) => {
    if (event.button !== 1 && !(event.button === 0 && event.altKey)) return;
    event.preventDefault(); // prevent browser scroll on middle-click
    setIsPanning(true);
    const paper = editor.paperRef.current;
    panRef.current = {
      x: event.clientX,
      y: event.clientY,
      tx: paper.translate().tx,
      ty: paper.translate().ty,
    };
  };

  const handleMouseMove = (event) => {
    if (!isPanning || !panRef.current) return;
    const paper = editor.paperRef.current;
    paper.translate(
      panRef.current.tx + event.clientX - panRef.current.x,
      panRef.current.ty + event.clientY - panRef.current.y
    );
  };

  const stopPan = () => {
    setIsPanning(false);
    panRef.current = null;
  };

  return (
    <div
      className={`joint-paper-host${isPanning ? " is-panning" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onMouseLeave={stopPan}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPan}
      ref={paperElementRef}
    />
  );
}