import Icon from './Icons';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotice {
  id: number;
  kind: ToastKind;
  title: string;
  message: string;
}

interface ToastProps {
  notice: ToastNotice | null;
  onClose: () => void;
}

export default function Toast({ notice, onClose }: ToastProps) {
  if (!notice) return null;

  return (
    <div className="toast-region" aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}>
      <div key={notice.id} className={`feedback-toast ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
        <span className="feedback-toast-icon" aria-hidden="true">
          <Icon name={notice.kind === 'success' ? 'check' : notice.kind === 'info' ? 'clock' : 'close'} size={19}/>
        </span>
        <div className="feedback-toast-body">
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
        </div>
        <button type="button" aria-label="Fechar notificação" onClick={onClose} className="feedback-toast-close">
          <Icon name="close" size={18}/>
        </button>
      </div>
    </div>
  );
}
