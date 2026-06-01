import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { bookingService } from '../services/bookingService.js';

function formatDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function BookingModal({
  slot,
  date,
  services,
  allTherapists,
  lockedTherapist,
  onComplete,
  onClose,
}) {
  const { user } = useAuth();

  const [therapistId, setTherapistId] = useState(
    lockedTherapist?.id ?? (slot.availableTherapists.length === 1 ? slot.availableTherapists[0].id : '')
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [name, setName] = useState(user ? `${user.first_name} ${user.last_name}` : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Therapist dropdown: if locked, just show name; otherwise show those available for the slot
  const therapistOptions = useMemo(() => {
    if (lockedTherapist) return [lockedTherapist];
    return slot.availableTherapists;
  }, [lockedTherapist, slot.availableTherapists]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!therapistId) { setError('Please select a therapist.'); return; }
    if (!serviceId) { setError('Please select a service.'); return; }
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('A valid email address is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Build scheduledAt: combine date + slotStartTime as UTC
    const scheduledAt = `${date}T${slot.startTime}:00.000Z`;

    try {
      await bookingService.createAppointment({
        therapistId,
        serviceId,
        scheduledAt,
        notes: notes.trim() || undefined,
        // Guest fields only when not authenticated
        ...(!user && { guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim() || undefined }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="avail-modal-overlay" onClick={onClose} role="presentation">
        <div className="avail-modal booking-modal--success" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="booking-modal__success-icon">✓</div>
          <h3 className="booking-modal__success-title">Booking Confirmed!</h3>
          <p className="booking-modal__success-body">
            Your appointment has been booked for {formatDate(date)} at {formatTime(slot.startTime)}.
            {!user && ' A confirmation will be sent to ' + email + '.'}
          </p>
          <button className="btn btn--primary" onClick={() => { onComplete(); onClose(); }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="avail-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="avail-modal booking-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        <button className="avail-modal__close" onClick={onClose} aria-label="Close">×</button>

        <h3 id="booking-modal-title" className="avail-modal__title">Book Appointment</h3>
        <p className="booking-modal__slot-summary">
          {formatDate(date)} · {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Service selection */}
          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-service">Service</label>
            <select
              id="bm-service"
              className="booking-field__input"
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
              disabled={submitting}
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${(s.priceCents / 100).toFixed(0)}
                </option>
              ))}
            </select>
          </div>

          {/* Therapist selection */}
          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-therapist">Therapist</label>
            {lockedTherapist ? (
              <p className="booking-field__locked">
                {lockedTherapist.firstName} {lockedTherapist.lastName}
              </p>
            ) : (
              <select
                id="bm-therapist"
                className="booking-field__input"
                value={therapistId}
                onChange={e => setTherapistId(e.target.value)}
                disabled={submitting}
              >
                {therapistOptions.length > 1 && <option value="">Select a therapist…</option>}
                {therapistOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                ))}
              </select>
            )}
          </div>

          <div className="booking-divider">Contact Information</div>

          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-name">Full name</label>
            <input
              id="bm-name"
              className="booking-field__input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={submitting}
              autoComplete="name"
              required
            />
          </div>

          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-email">Email</label>
            <input
              id="bm-email"
              className="booking-field__input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={submitting}
              autoComplete="email"
              required
            />
          </div>

          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-phone">
              Phone <span className="booking-field__optional">(optional)</span>
            </label>
            <input
              id="bm-phone"
              className="booking-field__input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              disabled={submitting}
              autoComplete="tel"
            />
          </div>

          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-notes">
              Notes <span className="booking-field__optional">(optional)</span>
            </label>
            <textarea
              id="bm-notes"
              className="booking-field__input booking-field__input--textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="Any areas to focus on, health considerations, etc."
            />
          </div>

          <div className="booking-payment-note">
            Payment will be collected at time of service.
          </div>

          {error && <p className="avail-modal__error">{error}</p>}

          <div className="avail-modal__actions">
            <button className="btn btn--primary" type="submit" disabled={submitting}>
              {submitting ? 'Booking…' : 'Confirm Booking'}
            </button>
            <button className="btn btn--ghost" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
