import { useState, useMemo } from 'react';

function formatDateLabel(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function AvailabilityModal({
  selectedDates,
  businessHours,
  availabilityMap,
  onSave,
  onRemove,
  onClose,
}) {
  const sorted = [...selectedDates].sort();

  // Use the first selected date's existing availability as the default, or 09:00–17:00
  const firstAvail = availabilityMap[sorted[0]];
  const [startTime, setStartTime] = useState(firstAvail?.start_time?.slice(0, 5) ?? '09:00');
  const [endTime, setEndTime] = useState(firstAvail?.end_time?.slice(0, 5) ?? '17:00');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Compute the most restrictive business-hours window across all selected dates
  const timeBounds = useMemo(() => {
    let latestOpen = null;
    let earliestClose = null;
    for (const ds of sorted) {
      const dow = new Date(`${ds}T12:00:00`).getDay();
      const bh = businessHours.find(h => h.day_of_week === dow && !h.is_closed);
      if (!bh) continue;
      const open = bh.open_time.slice(0, 5);
      const close = bh.close_time.slice(0, 5);
      if (!latestOpen || open > latestOpen) latestOpen = open;
      if (!earliestClose || close < earliestClose) earliestClose = close;
    }
    return { min: latestOpen ?? '00:00', max: earliestClose ?? '23:59' };
  }, [sorted, businessHours]);

  const hasExisting = sorted.some(d => availabilityMap[d]);

  // Build a summary label for the selected dates
  let datesLabel;
  if (sorted.length === 1) {
    datesLabel = formatDateLabel(sorted[0]);
  } else if (sorted.length <= 4) {
    datesLabel = sorted.map(formatDateLabel).join(', ');
  } else {
    datesLabel = `${sorted.length} days (${formatDateLabel(sorted[0])} – ${formatDateLabel(sorted[sorted.length - 1])})`;
  }

  function validate() {
    if (!startTime || !endTime) return 'Both times are required.';
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) return 'End time must be after start time.';
    if (timeToMinutes(startTime) < timeToMinutes(timeBounds.min))
      return `Start time cannot be before business opens at ${timeBounds.min}.`;
    if (timeToMinutes(endTime) > timeToMinutes(timeBounds.max))
      return `End time cannot be after business closes at ${timeBounds.max}.`;
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(sorted.map(date => ({ date, startTime, endTime })));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError('');
    try {
      await onRemove(sorted);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="avail-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="avail-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avail-modal-title"
      >
        <button className="avail-modal__close" onClick={onClose} aria-label="Close dialog">×</button>

        <h3 id="avail-modal-title" className="avail-modal__title">Set Availability</h3>
        <p className="avail-modal__dates">{datesLabel}</p>

        {timeBounds.min !== '00:00' && (
          <p className="avail-modal__hours-hint">
            Business hours: {timeBounds.min}–{timeBounds.max}
          </p>
        )}

        <div className="avail-modal__form">
          <label className="avail-modal__label">
            Start time
            <input
              type="time"
              className="avail-modal__input"
              value={startTime}
              min={timeBounds.min}
              max={timeBounds.max}
              onChange={e => setStartTime(e.target.value)}
            />
          </label>
          <label className="avail-modal__label">
            End time
            <input
              type="time"
              className="avail-modal__input"
              value={endTime}
              min={timeBounds.min}
              max={timeBounds.max}
              onChange={e => setEndTime(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="avail-modal__error">{error}</p>}

        <div className="avail-modal__actions">
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {hasExisting && (
            <button className="btn btn--danger btn--sm" onClick={handleRemove} disabled={saving}>
              Remove
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
