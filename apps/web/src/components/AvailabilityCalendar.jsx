import { useMemo } from 'react';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

export default function AvailabilityCalendar({
  year,
  month,
  availability,
  businessHours,
  selectedDates,
  onDayClick,
  onMonthChange,
}) {
  const today = todayStr();

  const availMap = useMemo(
    () => Object.fromEntries(availability.map(a => [a.specific_date, a])),
    [availability]
  );

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
    cells.push({
      day: d,
      dateStr: ds,
      dayOfWeek: new Date(year, month - 1, d).getDay(),
      isPast: ds < today,
      avail: availMap[ds] ?? null,
    });
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
    <div className="avail-calendar">
      <div className="avail-calendar__header">
        <button className="avail-calendar__nav" onClick={prevMonth} aria-label="Previous month">‹</button>
        <h2 className="avail-calendar__month">{monthLabel}</h2>
        <button className="avail-calendar__nav" onClick={nextMonth} aria-label="Next month">›</button>
      </div>

      <div className="avail-calendar__grid">
        {DOW_LABELS.map(l => (
          <div key={l} className="avail-calendar__dow">{l}</div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`pad-${i}`} className="avail-calendar__cell avail-calendar__cell--pad" />;
          }

          const { day, dateStr, dayOfWeek, isPast, avail } = cell;
          const isClosed = closedDays.has(dayOfWeek);
          const isSelected = selectedDates.has(dateStr);
          const isToday = dateStr === today;
          const disabled = isPast || isClosed;

          const classes = [
            'avail-calendar__cell',
            isClosed && 'avail-calendar__cell--closed',
            isPast && 'avail-calendar__cell--past',
            avail && !isClosed && 'avail-calendar__cell--available',
            isSelected && 'avail-calendar__cell--selected',
            isToday && 'avail-calendar__cell--today',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={dateStr}
              className={classes}
              disabled={disabled}
              onClick={() => onDayClick(dateStr)}
              aria-pressed={isSelected}
              aria-label={[
                dateStr,
                avail ? `available ${avail.start_time.slice(0, 5)}–${avail.end_time.slice(0, 5)}` : '',
                isClosed ? 'closed' : '',
              ].filter(Boolean).join(', ')}
            >
              <span className={`avail-calendar__day-num${isToday ? ' avail-calendar__day-num--today' : ''}`}>
                {day}
              </span>
              {avail && !isClosed && (
                <span className="avail-calendar__time-badge">
                  {avail.start_time.slice(0, 5)}–{avail.end_time.slice(0, 5)}
                </span>
              )}
              {isClosed && (
                <span className="avail-calendar__closed-label">Closed</span>
              )}
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
