import { useState, useMemo, useEffect, useRef } from 'react';
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

const WAIVER_ITEMS = [
  'I voluntarily request and consent to receiving massage therapy.',
  'I understand that the massage service offered is for the purposes of general wellness, stress reduction, and relief of muscular tension only.',
  'I do not have any injuries or conditions that prevent me from receiving massage therapy. I understand the importance of informing my massage therapist of all medical conditions and medications that I am taking, and that there may be additional risks based on my physical condition.',
  'If I experience any pain or discomfort, I will immediately inform my therapist so that the pressure or techniques used can be adjusted to my comfort level. I will not hold my massage therapist responsible for any pain or discomfort I experience during or after the session.',
  <>I understand the risks associated with massage therapy include but are not limited to: <em>superficial bruising, short-term muscle soreness, and exacerbation of undiscovered injury.</em></>,
  'I do not have any contagious conditions that may put my massage therapist or other clients at risk.',
  'I understand that I or the massage therapist may terminate the session at any time.',
  'I have been given the opportunity to ask questions about massage therapy and my questions have been answered.',
  'I have been advised of the policies and procedures pertaining to massage and I understand these policies.',
  'Information regarding massage in general, benefits, contraindications of massage, and possible alternative therapies have been explained to me.',
];

const WAIVER_CLOSING = 'I further understand that massage therapy is not a substitute for a medical examination or treatment, and that I should see a physician or other qualified health specialist for any mental or physical ailment of which I am aware. I understand that massage therapists do not diagnose illness or disease, and nothing said during the massage should be construed as such. My consent is informed and voluntary and I understand that I may withdraw my consent at any time except for actions already taken.';

// ── Signature canvas ───────────────────────────────────────────────────────────

function SignatureCanvas({ onChange }) {
  const canvasRef = useRef(null);
  const clearRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    clearRef.current = () => {
      ctx.clearRect(0, 0, cssW, cssH);
      onChangeRef.current('');
    };

    let isDrawing = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return [src.clientX - rect.left, src.clientY - rect.top];
    }

    function onStart(e) {
      e.preventDefault();
      isDrawing = true;
      const [x, y] = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function onMove(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const [x, y] = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    function onEnd(e) {
      if (!isDrawing) return;
      e.preventDefault();
      isDrawing = false;
      onChangeRef.current(canvas.toDataURL());
    }

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('mouseleave', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('mouseleave', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, []);

  return (
    <div className="waiver-sig">
      <p className="waiver-sig__label">Sign below</p>
      <canvas ref={canvasRef} className="waiver-sig__canvas" />
      <button
        type="button"
        className="waiver-sig__clear"
        onClick={() => clearRef.current?.()}
      >
        Clear
      </button>
    </div>
  );
}

// ── Waiver step ────────────────────────────────────────────────────────────────

function WaiverStep({ slot, date, onBack, onSign, submitting, error }) {
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="avail-modal-overlay" role="presentation">
      <div
        className="avail-modal booking-modal booking-modal--waiver"
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiver-modal-title"
      >
        <h3 id="waiver-modal-title" className="avail-modal__title">Massage Therapy Consent</h3>
        <p className="booking-modal__slot-summary">
          {formatDate(date)} · {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
        </p>

        <div className="waiver-scroll" role="region" aria-label="Waiver text">
          <ol className="waiver-list">
            {WAIVER_ITEMS.map((item, i) => (
              <li key={i} className="waiver-list__item">{item}</li>
            ))}
          </ol>
          <p className="waiver-closing">{WAIVER_CLOSING}</p>
        </div>

        <SignatureCanvas onChange={setSignature} />

        <label className="waiver-agree">
          <input
            type="checkbox"
            className="waiver-agree__checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            disabled={submitting}
          />
          <span className="waiver-agree__text">
            I have read and agree to the above consent form
          </span>
        </label>

        {error && <p className="avail-modal__error">{error}</p>}

        <div className="avail-modal__actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => onSign(signature)}
            disabled={!signature || !agreed || submitting}
          >
            {submitting ? 'Booking…' : 'Sign & Book'}
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inner form (must be inside <Elements> when new-card path is active) ────────

function BookingForm({
  slot, date, services, therapistOptions, lockedTherapist,
  therapistId, setTherapistId,
  serviceId,
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

  const [step, setStep] = useState('form'); // 'form' | 'waiver' | 'success'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stagedPaymentMethodId, setStagedPaymentMethodId] = useState(null);

  const selectedService = services.find(s => s.id === serviceId);
  const needsPayment = !!stripePublishableKey;
  const isNewCard = selectedMethodId === 'new';

  const isFormReady = (() => {
    if (!user) {
      if (!name.trim()) return false;
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    }
    if (loadingMethods) return false;
    if (needsPayment && !selectedMethodId) return false;
    return true;
  })();

  function validateForm() {
    if (!user) {
      if (!name.trim()) { setError('Name is required.'); return false; }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('A valid email is required.'); return false;
      }
    }
    if (needsPayment && !selectedMethodId) {
      setError('Please select a payment method.'); return false;
    }
    return true;
  }

  async function handleContinue(e) {
    e.preventDefault();
    if (!validateForm()) return;

    // Tokenize the new card before transitioning — the CardElement unmounts on
    // the waiver step, so elements.getElement(CardElement) returns null there.
    if (needsPayment && isNewCard && stripe) {
      setSubmitting(true);
      const cardElement = elements.getElement(CardElement);
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });
      setSubmitting(false);
      if (pmError) {
        setError(pmError.message);
        return;
      }
      setStagedPaymentMethodId(paymentMethod.id);
    }

    setError('');
    setStep('waiver');
  }

  async function handleSign(waiverSignature) {
    if (!waiverSignature) { setError('Please sign the consent form.'); return; }

    setSubmitting(true);
    setError('');

    const scheduledAt = `${date}T${slot.startTime}:00.000Z`;
    const savedMethod = paymentMethods.find(m => m.id === selectedMethodId);

    try {
      const result = await bookingService.createAppointment({
        therapistId: therapistId || undefined,
        serviceId,
        scheduledAt,
        notes: notes.trim() || undefined,
        paymentMethodId: savedMethod ? savedMethod.id : undefined,
        waiverSignature,
        ...(!user && { guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim() || undefined }),
      });

      const { appointment, clientSecret } = result;

      if (clientSecret && stripe) {
        let confirmResult;
        if (isNewCard) {
          confirmResult = await stripe.confirmCardPayment(clientSecret, {
            payment_method: stagedPaymentMethodId,
          });
        } else if (savedMethod) {
          confirmResult = await stripe.confirmCardPayment(clientSecret, {
            payment_method: savedMethod.stripe_payment_method_id,
          });
        }
        if (confirmResult?.error) throw new Error(confirmResult.error.message);
        if (user) await bookingService.confirmAppointment(appointment.id);
      }

      setStep('success');
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setSubmitting(false);
    }
  }

  if (step === 'success') {
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

  if (step === 'waiver') {
    return (
      <WaiverStep
        slot={slot}
        date={date}
        onBack={() => { setError(''); setStep('form'); }}
        onSign={handleSign}
        submitting={submitting}
        error={error}
      />
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

        <form onSubmit={handleContinue} noValidate>
          {/* Therapist */}
          <div className="booking-field">
            <label className="booking-field__label" htmlFor="bm-therapist">Therapist preference</label>
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
                <option value="">Any therapist</option>
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
            <button
              className="btn btn--primary"
              type="submit"
              disabled={submitting || !isFormReady}
            >
              Continue to Consent Form →
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

  const [therapistId, setTherapistId] = useState(lockedTherapist?.id ?? '');
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [name, setName] = useState(user ? `${user.first_name} ${user.last_name}` : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState(user ? '' : 'new');

  const therapistOptions = useMemo(() => {
    if (lockedTherapist) return [lockedTherapist];
    return slot.availableTherapists;
  }, [lockedTherapist, slot.availableTherapists]);

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
