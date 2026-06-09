import { useEffect, useRef, useState } from 'react';

/**
 * SaveNameModal
 *
 * Minimal dark-themed dialog that captures a workflow name before saving.
 *
 * Props:
 *   isOpen   {boolean}
 *   initial  {string}   — pre-filled name (existing workflow name or '')
 *   onSave   {(name: string) => void}  — called with the confirmed name
 *   onClose  {() => void}              — called when dismissed without saving
 */
export default function SaveNameModal({ isOpen, initial = '', onSave, onClose }) {
  const [name, setName]   = useState('');
  const [error, setError] = useState('');
  const inputRef          = useRef(null);

  // Sync input value whenever the modal opens / initial name changes
  useEffect(() => {
    if (isOpen) {
      setName(initial || '');
      setError('');
      // Auto-focus and select all so the user can start typing immediately
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a workflow name.');
      inputRef.current?.focus();
      return;
    }
    onSave(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="snm-card" role="dialog" aria-modal="true" aria-labelledby="snm-title">
        <form onSubmit={handleSubmit} noValidate>

          {/* Header */}
          <header className="snm-header">
            <span id="snm-title" className="snm-title">
              <i className="fa fa-save" style={{ marginRight: 8 }} />
              Save Workflow
            </span>
            <button
              type="button"
              className="snm-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          {/* Body */}
          <div className="snm-body">
            <label className="snm-label" htmlFor="snm-name-input">
              Workflow Name
            </label>
            <input
              id="snm-name-input"
              ref={inputRef}
              type="text"
              className={`snm-input${error ? ' snm-input--error' : ''}`}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Pump Pressure Guard"
              maxLength={120}
              autoComplete="off"
            />
            {error && (
              <span className="snm-error" role="alert">{error}</span>
            )}
          </div>

          {/* Footer */}
          <footer className="snm-footer">
            <button type="button" className="snm-btn snm-btn--cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="snm-btn snm-btn--save">
              <i className="fa fa-save" style={{ marginRight: 6 }} />
              Save
            </button>
          </footer>

        </form>
      </div>
    </div>
  );
}
