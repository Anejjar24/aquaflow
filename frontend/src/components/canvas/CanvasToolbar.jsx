import { useRef } from "react";

export default function CanvasToolbar({
  autosaveStatus,
  canRedo,
  canUndo,
  isExecuting,
  onDelete,
  onDuplicate,
  onExecute,
  onExport,
  onFit,
  onImport,
  onRedo,
  onReset,
  onUndo,
  onZoomIn,
  onZoomOut,
  selectedNode,
  zoom,
}) {
  const fileInputRef = useRef(null);

  return (
    <header className="workflow-toolbar">
      <div className="toolbar-group">
        <button onClick={onExport} title="Export JSON" type="button">
          <i className="fa fa-download" aria-hidden="true" />
        </button>
        <button onClick={() => fileInputRef.current?.click()} title="Import JSON" type="button">
          <i className="fa fa-upload" aria-hidden="true" />
          <input
            accept="application/json"
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
          />
        </button>
      </div>
      <div className="toolbar-group">
        <button disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)" type="button">
          <i className="fa fa-undo" aria-hidden="true" />
        </button>
        <button disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Y)" type="button">
          <i className="fa fa-redo" aria-hidden="true" />
        </button>
      </div>
      <div className="toolbar-group">
        <button onClick={onZoomOut} title="Zoom out" type="button">
          <i className="fa fa-search-minus" aria-hidden="true" />
        </button>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
        <button onClick={onZoomIn} title="Zoom in" type="button">
          <i className="fa fa-search-plus" aria-hidden="true" />
        </button>
        <button onClick={onFit} title="Fit to screen (Ctrl+Shift+F)" type="button">
          <i className="fa fa-expand-arrows-alt" aria-hidden="true" />
        </button>
        <button onClick={onReset} title="Reset view (1:1)" type="button">
          <i className="fa fa-compress" aria-hidden="true" />
        </button>
      </div>
      <div className="toolbar-group">
        <button disabled={!selectedNode} onClick={onDuplicate} title="Duplicate node" type="button">
          <i className="fa fa-clone" aria-hidden="true" />
        </button>
        <button disabled={!selectedNode} onClick={onDelete} title="Delete node" type="button">
          <i className="fa fa-trash" aria-hidden="true" />
        </button>
        <button className="execute-button" disabled={isExecuting} onClick={onExecute} title="Execute workflow" type="button">
          <i className={`fa ${isExecuting ? "fa-spinner fa-spin" : "fa-play"}`} aria-hidden="true" />
          <span>{isExecuting ? "Running" : "Run"}</span>
        </button>
      </div>
      <div className="autosave-indicator">{autosaveStatus}</div>
    </header>
  );
}