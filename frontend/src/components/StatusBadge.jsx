import { STATUS_LABEL, STATUS_STYLE, LEAVE_STATUS_LABEL } from '../utils/format';

export function DailyStatusBadge({ status }) {
  const style = STATUS_STYLE[status] || 'text-ink-faint bg-paper-dim';
  const label = STATUS_LABEL[status] || status;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
  );
}

export function LeaveStatusBadge({ status }) {
  const styles = {
    pending: 'text-gold-dark bg-gold-soft',
    approved: 'text-status-hadir bg-status-hadirBg',
    rejected: 'text-status-alpha bg-status-alphaBg',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${styles[status] || ''}`}>
      {LEAVE_STATUS_LABEL[status] || status}
    </span>
  );
}
