import { useApp } from '../context.jsx';

/**
 * Shared modal shell.
 * <Modal title="Add Client" onClose={...} full footer={<>buttons</>}>body</Modal>
 * `full` uses the wide "full page" modal (used by client/student forms).
 */
export default function Modal({ title, onClose, full = false, footer = null, children }) {
  const { styles: l } = useApp();
  return (
    <div style={l.modalOverlay} onClick={onClose} role="presentation">
      <div style={full ? l.modalFullPage : l.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div style={l.modalHeader}>
          <h3 style={l.modalTitle}>{title}</h3>
          <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={l.modalBody}>{children}</div>
        {footer && <div style={l.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}
