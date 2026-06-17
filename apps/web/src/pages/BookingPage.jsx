import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BookingCalendar from '../components/BookingCalendar.jsx';
import TimeSlotPanel from '../components/TimeSlotPanel.jsx';
import BookingModal from '../components/BookingModal.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { bookingService } from '../services/bookingService.js';

const TIME_OF_DAY_OPTIONS = [
  { value: '',          label: 'Any time' },
  { value: 'morning',   label: 'Morning (before noon)' },
  { value: 'afternoon', label: 'Afternoon (noon – 5 PM)' },
  { value: 'evening',   label: 'Evening (after 5 PM)' },
];

const DEFAULT_CALENDAR = { availableDays: [], businessHours: [], therapists: [], services: [] };

export default function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const year           = parseInt(searchParams.get('year'),  10) || new Date().getFullYear();
  const month          = parseInt(searchParams.get('month'), 10) || (new Date().getMonth() + 1);
  const selectedDate   = searchParams.get('date')        || '';
  const therapistFilter = searchParams.get('therapistId') || '';
  const timeOfDay      = searchParams.get('timeOfDay')   || '';

  const setParam = useCallback(updates => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v); else next.delete(k);
      }
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const timeSlotsRef = useRef(null);

  useEffect(() => {
    if (selectedDate && timeSlotsRef.current) {
      timeSlotsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedDate]);

  const {
    data: calendarData = DEFAULT_CALENDAR,
    loading: calendarLoading,
    error: calendarError,
    reload: reloadCalendar,
  } = useAsync(
    () => bookingService.getCalendar(year, month, therapistFilter, timeOfDay),
    [year, month, therapistFilter, timeOfDay]
  );

  const {
    data: slots = [],
    loading: slotsLoading,
    error: slotsError,
    reload: reloadSlots,
  } = useAsync(
    () => bookingService.getSlots(selectedDate, therapistFilter, timeOfDay).then(d => d.slots),
    [selectedDate, therapistFilter, timeOfDay],
    { skip: !selectedDate }
  );

  function handleMonthChange(newYear, newMonth) {
    setParam({ year: String(newYear), month: String(newMonth), date: '' });
  }

  function handleDayClick(dateStr) {
    setParam({ date: dateStr === selectedDate ? '' : dateStr });
  }

  function handleFilterChange(key, value) {
    setParam({ [key]: value, date: '' });
  }

  function refreshSlots() {
    if (!selectedDate) return;
    reloadSlots();
    reloadCalendar();
  }

  const lockedTherapist = therapistFilter
    ? (calendarData.therapists.find(t => t.id === therapistFilter) ?? null)
    : null;

  return (
    <div className="booking-page">
      <div className="booking-page__header">
        <h1 className="booking-page__title">Book an Appointment</h1>
        <p className="booking-page__subtitle">
          It&rsquo;s quick and easy and future-you will be grateful.
        </p>
      </div>

      <div className="booking-filters">
        <div className="booking-filters__group">
          <label className="booking-filters__label" htmlFor="bf-therapist">Therapist</label>
          <select id="bf-therapist" className="booking-filters__select"
            value={therapistFilter} onChange={e => handleFilterChange('therapistId', e.target.value)}>
            <option value="">Any therapist</option>
            {calendarData.therapists.map(t => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>
        </div>
        <div className="booking-filters__group">
          <label className="booking-filters__label" htmlFor="bf-time">Time of day</label>
          <select id="bf-time" className="booking-filters__select"
            value={timeOfDay} onChange={e => handleFilterChange('timeOfDay', e.target.value)}>
            {TIME_OF_DAY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {calendarError && <p className="booking-error">{calendarError}</p>}

      <BookingCalendar
        year={year} month={month}
        availableDays={calendarData.availableDays}
        businessHours={calendarData.businessHours}
        selectedDate={selectedDate}
        onDayClick={handleDayClick}
        onMonthChange={handleMonthChange}
        loading={calendarLoading}
      />

      <div ref={timeSlotsRef}>
        {selectedDate && (
          <TimeSlotPanel
            date={selectedDate}
            slots={slots ?? []}
            loading={slotsLoading}
            error={slotsError}
            onSelectSlot={setSelectedSlot}
          />
        )}
      </div>

      {selectedSlot && (
        <BookingModal
          slot={selectedSlot}
          date={selectedDate}
          services={calendarData.services}
          allTherapists={calendarData.therapists}
          lockedTherapist={lockedTherapist}
          onComplete={refreshSlots}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </div>
  );
}
