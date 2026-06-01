function formatDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function TimeSlotPanel({ date, slots, loading, error, onSelectSlot }) {
  return (
    <div className="slot-panel">
      <h3 className="slot-panel__heading">
        Available Times
        {date && <span className="slot-panel__date"> — {formatDate(date)}</span>}
      </h3>

      {loading && <p className="slot-panel__state">Loading times…</p>}
      {error && <p className="slot-panel__state slot-panel__state--error">{error}</p>}

      {!loading && !error && slots.length === 0 && (
        <p className="slot-panel__state">No available times match your filters for this day.</p>
      )}

      {!loading && slots.length > 0 && (
        <div className="slot-panel__grid">
          {slots.map(slot => (
            <button
              key={slot.startTime}
              className="slot-btn"
              onClick={() => onSelectSlot(slot)}
              aria-label={`${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}, ${slot.availableTherapists.length} therapist${slot.availableTherapists.length !== 1 ? 's' : ''} available`}
            >
              <span className="slot-btn__time">{formatTime(slot.startTime)}</span>
              {slot.availableTherapists.length > 1 && (
                <span className="slot-btn__count">{slot.availableTherapists.length} therapists</span>
              )}
              {slot.availableTherapists.length === 1 && (
                <span className="slot-btn__count">{slot.availableTherapists[0].firstName}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
