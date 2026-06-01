import { useMemo } from 'react';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDateStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function BookingCalendar({
  year,
  month,
  availableDays,
  businessHours,
  selectedDate,
  onDayClick,
  onMonthChange,
  loading,
}) {
  const today = localDateStr();

  const availableSet = useMemo(() => new Set(availableDays), [availableDays]);

  const closedDays = useMemo(
    () => new Set(businessHours.filter(h => h.is_closed).map(h => h.day_of_week)),
    [businessHours]
  );

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr: ds, dayOfWeek: new Date(year, month - 1, d).getDay() });
  }

  const monthLabel = new Date(year, month - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    onMonthChange(d.getFullYear(), d.getMonth() + 1);
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    onMonthChange(d.getFullYear(), d.getMonth() + 1);
  }

  return (
    <div className="avail-calendar booking-calendar">
      <div className="avail-calendar__header">
        <button className="avail-calendar__nav" onClick={prevMonth} aria-label="Previous month">‹</button>
        <h2 className="avail-calendar__month">{monthLabel}</h2>
        <button className="avail-calendar__nav" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      {loading && <div className="booking-calendar__loading">Loading availability…</div>}

      <div className="avail-calendar__grid">
        {DOW_LABELS.map(l => (
          <div key={l} className="avail-calendar__dow">{l}</div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`pad-${i}`} className="avail-calendar__cell avail-calendar__cell--pad" />;
          }

          const { day, dateStr, dayOfWeek } = cell;
          const isPast = dateStr < today;
          const isClosed = closedDays.has(dayOfWeek);
          const isAvailable = availableSet.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const clickable = !isPast && !isClosed && isAvailable;

          const classes = [
            'avail-calendar__cell',
            isClosed && 'avail-calendar__cell--closed',
            isPast && 'avail-calendar__cell--past',
            isAvailable && !isClosed && !isPast && 'avail-calendar__cell--available',
            isSelected && 'avail-calendar__cell--selected',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={dateStr}
              className={classes}
              disabled={!clickable}
              onClick={() => onDayClick(dateStr)}
              aria-pressed={isSelected}
              aria-label={`${dateStr}${isAvailable ? ', available' : ''}${isClosed ? ', closed' : ''}`}
            >
              <span className={`avail-calendar__day-num${isToday ? ' avail-calendar__day-num--today' : ''}`}>
                {day}
              </span>
              {isAvailable && !isClosed && !isPast && (
                <span className="avail-calendar__time-badge">Available</span>
              )}
              {isClosed && <span className="avail-calendar__closed-label">Closed</span>}
            </button>
          );
        })}
      </div>

      <div className="avail-calendar__legend">
        <span className="avail-calendar__legend-item avail-calendar__legend-item--available">Available</span>
        <span className="avail-calendar__legend-item avail-calendar__legend-item--selected">Selected</span>
        <span className="avail-calendar__legend-item avail-calendar__legend-item--closed">Closed</span>
      </div>
    </div>
  );
}
