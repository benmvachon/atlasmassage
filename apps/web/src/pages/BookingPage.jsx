import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import BookingCalendar from '../components/BookingCalendar.jsx';
import TimeSlotPanel from '../components/TimeSlotPanel.jsx';
import BookingModal from '../components/BookingModal.jsx';
import { bookingService } from '../services/bookingService.js';

const TIME_OF_DAY_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: 'morning', label: 'Morning (before noon)' },
  { value: 'afternoon', label: 'Afternoon (noon – 5 PM)' },
  { value: 'evening', label: 'Evening (after 5 PM)' },
];

export default function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const year = parseInt(searchParams.get('year'), 10) || new Date().getFullYear();
  const month = parseInt(searchParams.get('month'), 10) || (new Date().getMonth() + 1);
  const selectedDate = searchParams.get('date') || '';
  const therapistFilter = searchParams.get('therapistId') || '';
  const timeOfDay = searchParams.get('timeOfDay') || '';

  const setParam = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: false });
  }, [setSearchParams]);

  // Calendar data
  const [calendarData, setCalendarData] = useState({ availableDays: [], businessHours: [], therapists: [], services: [] });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState('');

  // Slot data
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  // Booking modal
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Load calendar whenever month/filters change
  useEffect(() => {
    setCalendarLoading(true);
    setCalendarError('');
    bookingService.getCalendar(year, month, therapistFilter, timeOfDay)
      .then(data => setCalendarData(data))
      .catch(err => setCalendarError(err.message))
      .finally(() => setCalendarLoading(false));
  }, [year, month, therapistFilter, timeOfDay]);

  // Load slots whenever selected date or filters change
  useEffect(() => {
    if (!selectedDate) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlotsError('');
    bookingService.getSlots(selectedDate, therapistFilter, timeOfDay)
      .then(data => setSlots(data.slots))
      .catch(err => setSlotsError(err.message))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, therapistFilter, timeOfDay]);

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
    bookingService.getSlots(selectedDate, therapistFilter, timeOfDay)
      .then(data => setSlots(data.slots))
      .catch(() => {});
    // Also refresh the calendar to reflect the new booking
    bookingService.getCalendar(year, month, therapistFilter, timeOfDay)
      .then(data => setCalendarData(data))
      .catch(() => {});
  }

  const lockedTherapist = therapistFilter
    ? calendarData.therapists.find(t => t.id === therapistFilter) ?? null
    : null;

  return (
    <div className="booking-page">
      <div className="booking-page__header">
        <h1 className="booking-page__title">Book an Appointment</h1>
        <p className="booking-page__subtitle">
          Select a date, choose your preferred time, and we'll take care of the rest.
        </p>
      </div>

      <div className="booking-filters">
        <div className="booking-filters__group">
          <label className="booking-filters__label" htmlFor="bf-therapist">Therapist</label>
          <select
            id="bf-therapist"
            className="booking-filters__select"
            value={therapistFilter}
            onChange={e => handleFilterChange('therapistId', e.target.value)}
          >
            <option value="">Any therapist</option>
            {calendarData.therapists.map(t => (
              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
            ))}
          </select>
        </div>

        <div className="booking-filters__group">
          <label className="booking-filters__label" htmlFor="bf-time">Time of day</label>
          <select
            id="bf-time"
            className="booking-filters__select"
            value={timeOfDay}
            onChange={e => handleFilterChange('timeOfDay', e.target.value)}
          >
            {TIME_OF_DAY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {calendarError && <p className="booking-error">{calendarError}</p>}

      <BookingCalendar
        year={year}
        month={month}
        availableDays={calendarData.availableDays}
        businessHours={calendarData.businessHours}
        selectedDate={selectedDate}
        onDayClick={handleDayClick}
        onMonthChange={handleMonthChange}
        loading={calendarLoading}
      />

      {selectedDate && (
        <TimeSlotPanel
          date={selectedDate}
          slots={slots}
          loading={slotsLoading}
          error={slotsError}
          onSelectSlot={setSelectedSlot}
        />
      )}

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
