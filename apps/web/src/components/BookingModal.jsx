import { useState, useMemo, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext.jsx';
import { bookingService } from '../services/bookingService.js';
import { paymentService } from '../services/paymentService.js';
import { getStripePromise, stripePublishableKey } from '../services/stripe.js';

function formatDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function brandLabel(brand) {
  return { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' }[brand] ?? 'Card';
}

const CARD_STYLE = {
  style: {
    base: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      color: '#1a1a2e',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
};

// ── Inner form (must be inside <Elements> when new-card path is active) ────────

function BookingForm({
  slot, date, services, therapistOptions, lockedTherapist,
  therapistId, setTherapistId,
  serviceId, setServiceId,
  name, setName,
  email, setEmail,
  phone, setPhone,
  notes, setNotes,
  paymentMethods, loadingMethods,
  selectedMethodId, setSelectedMethodId,
  onClose, onComplete,
}) {
  const { user } = useAuth();
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [, setConfirmedAppointment] = useState(null);

  const selectedService = services.find(s => s.id === serviceId);
  const needsPayment = !!stripePublishableKey;
  const isNewCard = selectedMethodId === 'new';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!therapistId) { setError('Please select a therapist.'); return; }
    if (!serviceId) { setError('Please select a service.'); return; }
    if (!user) {
      if (!name.trim()) { setError('Name is required.'); return; }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('A valid email is required.'); return;
      }
    }
    if (needsPayment && !selectedMethodId) {
      setError('Please select a payment method.'); return;
    }

    setSubmitting(true);
    setError('');

    const scheduledAt = `${date}T${slot.startTime}:00.000Z`;
    const savedMethod = paymentMethods.find(m => m.id === selectedMethodId);

    try {
      // 1. Create the appointment (backend also creates payment intent for auth clients)
      const result = await bookingService.createAppointment({
        therapistId,
        serviceId,
        scheduledAt,
        notes: notes.trim() || undefined,
        paymentMethodId: savedMethod ? savedMethod.id : undefined,
        ...(!user && { guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim() || undefined }),
      });

      const { appointment, clientSecret } = result;

      // 2. Confirm payment with Stripe if a clientSecret was returned
      if (clientSecret && stripe) {
        let confirmResult;

        if (isNewCard) {
          const cardElement = elements.getElement(CardElement);
          confirmResult = await stripe.confirmCardPayment(clientSecret, {
            payment_method: { card: cardElement },
          });
        } else if (savedMethod) {
          confirmResult = await stripe.confirmCardPayment(clientSecret, {
            payment_method: savedMethod.stripe_payment_method_id,
          });
        }

        if (confirmResult?.error) {
          throw new Error(confirmResult.error.message);
        }

        // 3. Tell the backend the payment is confirmed (auth users only).
        // Guests have no session, so the webhook handles their status update.
        if (user) await bookingService.confirmAppointment(appointment.id);
      }

      setConfirmedAppointment(appointment);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
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
            {!user && email && ` A confirmation will be sent to ${email}.`}
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
          {/* Service */}
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

          {/* Therapist */}
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

          {/* Contact info — only for guests */}
          {!user && (
            <>
              <div className="booking-divider">Contact Information</div>
              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-name">Full name</label>
                <input id="bm-name" className="booking-field__input" type="text"
                  value={name} onChange={e => setName(e.target.value)}
                  disabled={submitting} autoComplete="name" required />
              </div>
              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-email">Email</label>
                <input id="bm-email" className="booking-field__input" type="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={submitting} autoComplete="email" required />
              </div>
              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-phone">
                  Phone <span className="booking-field__optional">(optional)</span>
                </label>
                <input id="bm-phone" className="booking-field__input" type="tel"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  disabled={submitting} autoComplete="tel" />
              </div>
            </>
          )}

          {/* Notes */}
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
              rows={2}
              placeholder="Areas to focus on, health considerations, etc."
            />
          </div>

          {/* Payment */}
          {needsPayment ? (
            <>
              <div className="booking-divider">
                Payment
                {selectedService && (
                  <span className="booking-divider__amount">
                    ${(selectedService.priceCents / 100).toFixed(0)}
                  </span>
                )}
              </div>

              {loadingMethods ? (
                <p className="booking-payment-loading">Loading saved cards…</p>
              ) : (
                <div className="booking-payment-options">
                  {paymentMethods.map(pm => (
                    <label key={pm.id} className={`booking-pm-option${selectedMethodId === pm.id ? ' booking-pm-option--selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={pm.id}
                        checked={selectedMethodId === pm.id}
                        onChange={() => setSelectedMethodId(pm.id)}
                        disabled={submitting}
                      />
                      <span className="booking-pm-option__brand">{brandLabel(pm.brand)}</span>
                      <span className="booking-pm-option__number">•••• {pm.last4}</span>
                      <span className="booking-pm-option__expiry">
                        {String(pm.expiry_month).padStart(2, '0')}/{pm.expiry_year}
                      </span>
                      {pm.is_default && (
                        <span className="booking-pm-option__badge">Default</span>
                      )}
                    </label>
                  ))}

                  <label className={`booking-pm-option${isNewCard ? ' booking-pm-option--selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="new"
                      checked={isNewCard}
                      onChange={() => setSelectedMethodId('new')}
                      disabled={submitting}
                    />
                    <span className="booking-pm-option__brand">Enter a new card</span>
                  </label>

                  {isNewCard && (
                    <div className="booking-card-element">
                      <CardElement options={CARD_STYLE} />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="booking-payment-note">
              {user
                ? 'Payment processing is not configured — payment will be collected at time of service.'
                : 'Payment will be collected at time of service.'}
            </div>
          )}

          {error && <p className="avail-modal__error">{error}</p>}

          <div className="avail-modal__actions">
            <button className="btn btn--primary" type="submit" disabled={submitting || (needsPayment && !selectedMethodId)}>
              {submitting
                ? (needsPayment ? 'Processing payment…' : 'Booking…')
                : (needsPayment && selectedService
                    ? `Pay $${(selectedService.priceCents / 100).toFixed(0)} & Book`
                    : 'Confirm Booking')}
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

// ── Shell — fetches payment methods, wraps in <Elements> when needed ───────────

export default function BookingModal({
  slot, date, services, _allTherapists, lockedTherapist, onComplete, onClose,
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

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  // Guests always enter a new card; auth users start blank until cards load
  const [selectedMethodId, setSelectedMethodId] = useState(user ? '' : 'new');

  const therapistOptions = useMemo(() => {
    if (lockedTherapist) return [lockedTherapist];
    return slot.availableTherapists;
  }, [lockedTherapist, slot.availableTherapists]);

  // Fetch saved cards for authenticated clients when Stripe is active
  useEffect(() => {
    if (!user || !stripePublishableKey) return;
    setLoadingMethods(true);
    paymentService.listPaymentMethods()
      .then(({ data }) => {
        setPaymentMethods(data.methods);
        const def = data.methods.find(m => m.is_default);
        if (def) setSelectedMethodId(def.id);
        else if (data.methods.length > 0) setSelectedMethodId(data.methods[0].id);
        else setSelectedMethodId('new');
      })
      .catch(() => setSelectedMethodId('new'))
      .finally(() => setLoadingMethods(false));
  }, [user]);

  // Always wrap in Elements. When Stripe isn't configured stripePromise is null,
  // and the library returns null from useStripe()/useElements() rather than
  // throwing — so BookingForm's hooks are always called in the same order.
  const stripePromise = getStripePromise();
  const sharedProps = {
    slot, date, services, therapistOptions, lockedTherapist,
    therapistId, setTherapistId, serviceId, setServiceId,
    name, setName, email, setEmail, phone, setPhone, notes, setNotes,
    paymentMethods, loadingMethods, selectedMethodId, setSelectedMethodId,
    onClose, onComplete,
  };

  return (
    <Elements stripe={stripePromise}>
      <BookingForm {...sharedProps} />
    </Elements>
  );
}
