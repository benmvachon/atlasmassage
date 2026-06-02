const CLASS_MAP = {
  // Membership statuses
  active:    'settings-badge--active',
  paused:    'settings-badge--paused',
  cancelled: 'settings-badge--cancelled',
  expired:   'settings-badge--cancelled',
  // Appointment statuses
  pending:   'settings-badge--paused',
  confirmed: 'settings-badge--active',
  completed: 'settings-badge--info',
  no_show:   'settings-badge--cancelled',
};

const LABEL_MAP = {
  no_show: 'No Show',
};

export default function StatusBadge({ status }) {
  const label = LABEL_MAP[status] ?? status.replace(/_/g, ' ');
  return (
    <span className={`settings-badge ${CLASS_MAP[status] ?? ''}`}>
      {label}
    </span>
  );
}
