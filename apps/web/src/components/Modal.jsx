import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

export default function Modal({ title, onClose, children, maxWidth, labelId = 'modal-title' }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, { onEscape: onClose });

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="modal-panel"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={labelId}>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
