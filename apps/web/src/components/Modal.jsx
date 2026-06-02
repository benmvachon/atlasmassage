/**
 * Generic modal overlay + panel.
 * Clicking the backdrop calls onClose. The panel stops propagation.
 */
export default function Modal({ title, onClose, children, maxWidth, labelId = 'modal-title' }) {
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
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
