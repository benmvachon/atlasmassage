import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import AvailabilityCalendar from '../../components/AvailabilityCalendar.jsx';
import AvailabilityModal from '../../components/AvailabilityModal.jsx';
import { availabilityService } from '../../services/availabilityService.js';

export default function TherapistSchedulePage() {
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [availability, setAvailability] = useState([]);
  const [businessHours, setBusinessHours] = useState([]);
  const [dailyLimit, setDailyLimit] = useState(5);
  const [weeklyLimit, setWeeklyLimit] = useState(25);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedDates, setSelectedDates] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsError, setLimitsError] = useState('');
  const [limitsSuccess, setLimitsSuccess] = useState(false);

  const availabilityMap = useMemo(
    () => Object.fromEntries(availability.map(a => [a.specific_date, a])),
    [availability]
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError('');
    availabilityService
      .getTherapistMonth(user.id, year, month)
      .then(data => {
        setAvailability(data.availability);
        setBusinessHours(data.businessHours);
        setDailyLimit(data.dailyBookingLimit ?? 5);
        setWeeklyLimit(data.weeklyBookingLimit ?? 25);
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [user, year, month]);

  function handleMonthChange(newYear, newMonth) {
    setYear(newYear);
    setMonth(newMonth);
    setSelectedDates(new Set());
  }

  function handleDayClick(dateStr) {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  function clearSelection() {
    setSelectedDates(new Set());
    setModalOpen(false);
  }

  async function handleSave(entries) {
    const rows = await availabilityService.setAvailability(user.id, entries);
    setAvailability(prev => {
      const updated = [...prev];
      for (const row of rows) {
        const idx = updated.findIndex(a => a.specific_date === row.specific_date);
        if (idx >= 0) updated[idx] = row;
        else updated.push(row);
      }
      return updated;
    });
    clearSelection();
  }

  async function handleRemove(dates) {
    await availabilityService.removeAvailability(user.id, dates);
    const dateSet = new Set(dates);
    setAvailability(prev => prev.filter(a => !dateSet.has(a.specific_date)));
    clearSelection();
  }

  async function handleSaveLimits() {
    setLimitsSaving(true);
    setLimitsError('');
    setLimitsSuccess(false);
    try {
      await availabilityService.updateLimits(user.id, dailyLimit, weeklyLimit);
      setLimitsSuccess(true);
      setTimeout(() => setLimitsSuccess(false), 3000);
    } catch (err) {
      setLimitsError(err.message);
    } finally {
      setLimitsSaving(false);
    }
  }

  if (loading) return <div className="schedule-loading">Loading schedule…</div>;
  if (loadError) return <div className="schedule-error">{loadError}</div>;

  return (
    <div className="schedule-page">
      <h1 className="schedule-page__title">My Schedule</h1>

      <AvailabilityCalendar
        year={year}
        month={month}
        availability={availability}
        businessHours={businessHours}
        selectedDates={selectedDates}
        onDayClick={handleDayClick}
        onMonthChange={handleMonthChange}
      />

      {selectedDates.size > 0 && (
        <div className="schedule-action-bar">
          <span className="schedule-action-bar__count">
            {selectedDates.size} {selectedDates.size === 1 ? 'day' : 'days'} selected
          </span>
          <button className="btn btn--primary btn--sm" onClick={() => setModalOpen(true)}>
            Set Availability
          </button>
          <button className="btn btn--ghost btn--sm" onClick={clearSelection}>
            Clear Selection
          </button>
        </div>
      )}

      {modalOpen && (
        <AvailabilityModal
          selectedDates={[...selectedDates]}
          businessHours={businessHours}
          availabilityMap={availabilityMap}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={() => setModalOpen(false)}
        />
      )}

      <section className="schedule-limits">
        <h2 className="schedule-limits__title">Booking Limits</h2>
        <p className="schedule-limits__desc">
          Maximum bookings you accept per day and per week. These limits will be enforced when clients book.
        </p>
        <div className="schedule-limits__form">
          <label className="schedule-limits__label">
            Daily limit
            <input
              type="number"
              className="schedule-limits__input"
              value={dailyLimit}
              min={1}
              max={100}
              onChange={e => setDailyLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </label>
          <label className="schedule-limits__label">
            Weekly limit
            <input
              type="number"
              className="schedule-limits__input"
              value={weeklyLimit}
              min={1}
              max={500}
              onChange={e => setWeeklyLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </label>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleSaveLimits}
            disabled={limitsSaving}
          >
            {limitsSaving ? 'Saving…' : 'Save Limits'}
          </button>
          {limitsSuccess && <span className="schedule-limits__success">Saved!</span>}
          {limitsError && <span className="schedule-limits__error">{limitsError}</span>}
        </div>
      </section>
    </div>
  );
}
