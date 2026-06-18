import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext.jsx';
import { bookingService } from '../services/bookingService.js';
import { paymentService } from '../services/paymentService.js';
import { membershipService } from '../services/membershipService.js';
import { giftCardService } from '../services/giftCardService.js';
import { userService } from '../services/userService.js';
import { getStripePromise, stripePublishableKey } from '../services/stripe.js';
import { ALL_SERVICES } from '../data/services.js';

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

const TRAVEL_WAIVER_ITEM = 'Because this is a travel massage appointment, I will provide a clean, private, and suitable space — with enough room to set up a portable massage table — for my therapist to perform the massage.';

const CANCELLATION_POLICY = {
  commitment: 'To provide the highest level of service and ensure appointment availability for all clients, reserved appointment times are held exclusively for you.',
  notice: 'Clients are required to provide at least 24 hours\' notice to cancel or reschedule an appointment.',
  charge: 'Appointments cancelled, rescheduled, or missed with less than 24 hours\' notice will result in an automatic charge of 100% of the scheduled service fee to the credit or debit card on file.',
  applies: [
    'Cancellations made less than 24 hours before the scheduled appointment time',
    'Missed appointments ("no-shows")',
    'Appointments where the client arrives too late to reasonably complete the scheduled service and chooses not to proceed',
  ],
  exceptions: [
    'Serious illness',
    'Medical emergencies',
    'Family emergencies',
    'Severe weather or natural disasters',
    'Other unforeseen circumstances deemed reasonable by management',
  ],
  exceptionsNote: 'Exceptions may be considered at the sole discretion of the practice. Approval of any exception is not guaranteed and will be reviewed on a case-by-case basis.',
  cardOnFile: [
    'A valid credit or debit card may be securely maintained on file.',
    'Appointments cancelled or rescheduled within 24 hours of the scheduled appointment time will be charged the full service fee.',
    'Missed appointments will be charged the full service fee.',
    'I authorize the practice to process such charges automatically using the payment method on file.',
    'This authorization remains in effect until revoked in writing and all outstanding balances have been paid.',
  ],
};

const STEP_LABELS = {
  contact: 'Contact',
  address: 'Address',
  health: 'Medical History',
  consent: 'Consent',
  payment: 'Payment',
};

const PREGNANCY_OPTIONS = [
  { value: 'not_pregnant', label: 'Not pregnant' },
  { value: 'pregnant', label: 'Currently pregnant' },
  { value: 'recently_pregnant', label: 'Recently pregnant (within 3 months)' },
];

function computeSteps(user, hasHealthRecord, hasConsent, restrictions, travelModeEnabled) {
  const steps = [];
  if (!user) {
    steps.push('contact');
  } else if (travelModeEnabled && !user.address_line1) {
    steps.push('address');
  }
  const anyRestriction = restrictions?.restrict_pregnancy || restrictions?.restrict_minors;
  if (!user || !hasHealthRecord || anyRestriction) steps.push('health');
  if (!user || !hasConsent) steps.push('consent');
  steps.push('payment');
  return steps;
}

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
      <canvas ref={canvasRef} className="waiver-sig__canvas" aria-label="Signature pad — draw your signature with a mouse or touch" />
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

// ── Wizard (must be inside <Elements> for Stripe card access) ─────────────────

function BookingWizard({
  slot, date, services, therapistOptions, lockedTherapist,
  paymentMethods, loadingMethods, selectedMethodId, setSelectedMethodId,
  membershipStatus,
  consentStatus, loadingConsent,
  healthStatus, loadingHealth,
  restrictions,
  travelModeEnabled,
  onClose, onComplete,
}) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stripe = useStripe();
  const elements = useElements();

  const [guestMode, setGuestMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingAddress, setVerifyingAddress] = useState(false);
  const [error, setError] = useState('');

  // Contact
  const [name, setName] = useState(user ? `${user.first_name} ${user.last_name}` : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [zip, setZip] = useState('');

  // Health
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [medications, setMedications] = useState('');
  const [surgeries, setSurgeries] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState('not_pregnant');
  const [injuries, setInjuries] = useState('');
  const [notes, setNotes] = useState('');

  // Consent
  const [signature, setSignature] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [cancellationAgreed, setCancellationAgreed] = useState(false);

  const compatibleServices = useMemo(
    () => {
      const available = slot.availableDurations;
      if (!available) return services;
      return services.filter(s => available.includes(s.durationMinutes));
    },
    [services, slot.availableDurations]
  );

  // Payment
  const [therapistId, setTherapistId] = useState(lockedTherapist?.id ?? '');
  const [serviceId, setServiceId] = useState(() => compatibleServices[0]?.id ?? '');

  // Gift card
  const [giftCardInput, setGiftCardInput] = useState('');
  const [giftCardApplied, setGiftCardApplied] = useState(null); // { code, remainingBalanceCents, originalAmountCents }
  const [giftCardError, setGiftCardError] = useState('');
  const [giftCardLoading, setGiftCardLoading] = useState(false);

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, { onEscape: onClose });

  const hasConsent = !!(user && consentStatus?.hasSigned);
  const hasHealthRecord = !!(user && healthStatus?.hasRecord);
  const isReturnClient = hasHealthRecord && hasConsent;

  const steps = useMemo(
    () => computeSteps(user, hasHealthRecord, hasConsent, restrictions, travelModeEnabled),
    [user, hasHealthRecord, hasConsent, restrictions, travelModeEnabled]
  );

  // Initialize first step once status data has loaded; also re-initialize if
  // the current step was set before auth completed and is no longer in steps.
  useEffect(() => {
    if (!loadingConsent && !loadingHealth && (currentStep === null || !steps.includes(currentStep))) {
      setCurrentStep(steps[0]);
    }
  }, [loadingConsent, loadingHealth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset signature state each time the consent step is shown
  useEffect(() => {
    if (currentStep === 'consent') {
      setSignature('');
      setAgreed(false);
      setCancellationAgreed(false);
    }
  }, [currentStep]);

  // Pre-fill address fields from the logged-in user's profile
  useEffect(() => {
    if (user) {
      setAddressLine1(user.address_line1 ?? '');
      setAddressLine2(user.address_line2 ?? '');
      setCity(user.city ?? '');
      setAddressState(user.state ?? '');
      setZip(user.zip ?? '');
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepIndex = steps.indexOf(currentStep ?? steps[0]);
  const selectedService = services.find(s => s.id === serviceId);
  const membershipCoversBooking = !!(membershipStatus?.active && membershipStatus.creditsRemaining > 0);
  const needsPayment = !!stripePublishableKey && !membershipCoversBooking;
  const isNewCard = selectedMethodId === 'new';

  function goNext() {
    setError('');
    setCurrentStep(steps[stepIndex + 1]);
  }

  function goBack() {
    setError('');
    setCurrentStep(steps[stepIndex - 1]);
  }

  // ── Step handlers ────────────────────────────────────────────────────────────

  const isContactReady = !!(
    name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    addressLine1.trim() &&
    city.trim() &&
    addressState.trim() &&
    zip.trim()
  );

  async function handleContactNext(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('A valid email address is required.'); return;
    }
    if (!addressLine1.trim()) { setError('Street address is required.'); return; }
    if (!city.trim()) { setError('City is required.'); return; }
    if (!addressState.trim()) { setError('State is required.'); return; }
    if (!zip.trim()) { setError('ZIP code is required.'); return; }
    setError('');

    setVerifyingAddress(true);
    try {
      const result = await bookingService.validateAddress({
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: addressState.trim(),
        zip: zip.trim(),
      });
      if (!result.valid) {
        setError(
          result.outOfServiceArea
            ? "We're sorry — this address is outside our 20-minute travel service area."
            : "We couldn't verify this address. Please check it for typos and try again."
        );
        return;
      }
    } catch (err) {
      setError(err.message || 'Could not verify this address. Please try again.');
      return;
    } finally {
      setVerifyingAddress(false);
    }

    goNext();
  }

  const isAddressReady = !!(
    addressLine1.trim() &&
    city.trim() &&
    addressState.trim() &&
    zip.trim()
  );

  async function handleAddressNext(e) {
    e.preventDefault();
    if (!addressLine1.trim()) { setError('Street address is required.'); return; }
    if (!city.trim()) { setError('City is required.'); return; }
    if (!addressState.trim()) { setError('State is required.'); return; }
    if (!zip.trim()) { setError('ZIP code is required.'); return; }
    setError('');

    setVerifyingAddress(true);
    try {
      const result = await bookingService.validateAddress({
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: addressState.trim(),
        zip: zip.trim(),
      });
      if (!result.valid) {
        setError(
          result.outOfServiceArea
            ? "We're sorry — this address is outside our 20-minute travel service area."
            : "We couldn't verify this address. Please check it for typos and try again."
        );
        return;
      }
      await userService.updateMe({
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || null,
        city: city.trim(),
        state: addressState.trim(),
        zip: zip.trim(),
      });
    } catch (err) {
      setError(err.message || 'Could not verify this address. Please try again.');
      return;
    } finally {
      setVerifyingAddress(false);
    }

    goNext();
  }

  function handleHealthNext(e) {
    e.preventDefault();
    setError('');

    if (restrictions?.restrict_pregnancy &&
        (pregnancyStatus === 'pregnant' || pregnancyStatus === 'recently_pregnant')) {
      setError(
        'We are not currently certified for prenatal or postnatal massage. Please contact us for more information.'
      );
      return;
    }

    if (restrictions?.restrict_minors) {
      if (!dateOfBirth) {
        setError('Date of birth is required.');
        return;
      }
      const birth = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) {
        setError(
          'We are not currently certified for pediatric massage. Please contact us for more information.'
        );
        return;
      }
    }

    goNext();
  }

  function handleConsentNext() {
    if (!signature) { setError('Please draw your signature.'); return; }
    if (!agreed) { setError('Please check the agreement box.'); return; }
    if (!cancellationAgreed) { setError('Please acknowledge the cancellation policy.'); return; }
    setError('');
    goNext();
  }

  async function applyGiftCard() {
    const code = giftCardInput.trim().toUpperCase();
    if (!code) return;
    setGiftCardError('');
    setGiftCardLoading(true);
    try {
      const cardData = await giftCardService.validate(code);
      setGiftCardApplied({ code: cardData.code, remainingBalanceCents: cardData.remainingBalanceCents, originalAmountCents: cardData.originalAmountCents });
      setGiftCardInput('');
    } catch (err) {
      setGiftCardError(err?.response?.data?.message || 'Gift card not found or not valid.');
    } finally {
      setGiftCardLoading(false);
    }
  }

  function removeGiftCard() {
    setGiftCardApplied(null);
    setGiftCardError('');
    setGiftCardInput('');
  }

  async function submitBooking(waiverSignature) {
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
        ...(giftCardApplied && { giftCardCode: giftCardApplied.code }),
        ...(waiverSignature && { waiverSignature }),
        ...(!user && {
          guestName: name.trim(),
          guestEmail: email.trim(),
          guestPhone: phone.trim() || undefined,
          guestAddressLine1: addressLine1.trim(),
          guestAddressLine2: addressLine2.trim() || undefined,
          guestCity: city.trim(),
          guestState: addressState.trim(),
          guestZip: zip.trim(),
        }),
        // Health fields only when no existing record is on file
        ...(!hasHealthRecord && {
          healthDateOfBirth: dateOfBirth || undefined,
          healthCurrentMedications: medications.trim() || undefined,
          healthRecentSurgeries: surgeries.trim() || undefined,
          healthPregnancyStatus: pregnancyStatus || undefined,
          healthInjuries: injuries.trim() || undefined,
        }),
      });

      const { appointment, clientSecret } = result;

      // clientSecret is null when the appointment was already confirmed server-side
      // (membership credit, existing saved card, or Stripe not configured).
      if (clientSecret && stripe) {
        const cardElement = elements.getElement(CardElement);
        const confirmResult = await stripe.confirmCardSetup(clientSecret, {
          payment_method: isNewCard
            ? { card: cardElement }
            : savedMethod?.stripe_payment_method_id,
        });
        if (confirmResult?.error) {
          bookingService.cancelAppointment(appointment.id, appointment.cancel_token).catch(() => {});
          throw new Error(confirmResult.error.message);
        }
        // Send the Stripe PM ID back so the server can store it for no-show charges.
        const stripePaymentMethodId = confirmResult.setupIntent?.payment_method;
        await bookingService.confirmAppointment(appointment.id, appointment.cancel_token, stripePaymentMethodId);
      }

      setCurrentStep('success');
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setSubmitting(false);
    }
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (needsPayment && !selectedMethodId) {
      setError('Please select a payment method.');
      return;
    }
    const waiverSig = hasConsent ? null : signature;
    await submitBooking(waiverSig);
  }

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loadingConsent || loadingHealth || currentStep === null) {
    return (
      <div className="avail-modal-overlay" role="presentation">
        <div className="avail-modal booking-modal" role="dialog" aria-modal="true" aria-label="Loading booking form">
          <p className="booking-modal__loading">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (currentStep === 'success') {
    return (
      <div className="avail-modal-overlay" onClick={onClose} role="presentation">
        <div className="avail-modal booking-modal--success" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="booking-success-title">
          <div className="booking-modal__success-icon" aria-hidden="true">✓</div>
          <h3 id="booking-success-title" className="booking-modal__success-title">Booking Confirmed!</h3>
          <p className="booking-modal__success-body">
            Your appointment has been booked for {formatDate(date)} at {formatTime(slot.startTime)}.
            {!user && email && ` A confirmation will be sent to ${email}.`}
          </p>
          <button className="btn btn--primary" onClick={() => { onComplete(); onClose(); }}>Done</button>
        </div>
      </div>
    );
  }

  // ── Guest gate ────────────────────────────────────────────────────────────────

  if (!authLoading && !user && !guestMode) {
    return (
      <div className="avail-modal-overlay" onClick={onClose} role="presentation">
        <div
          ref={dialogRef}
          className="avail-modal booking-modal booking-modal--gate"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
        >
          <div className="booking-modal__header">
            <button className="avail-modal__close" onClick={onClose} aria-label="Close">×</button>
            <h3 id="booking-modal-title" className="avail-modal__title">Book Appointment</h3>
            <p className="booking-modal__slot-summary">
              {formatDate(date)} · {formatTime(slot.startTime)}
            </p>
          </div>
          <div className="booking-modal__body booking-gate">
            <p className="booking-gate__heading">How would you like to book?</p>
            <p className="booking-gate__sub">
              Members enjoy faster checkout and can view their booking history.
            </p>
            <div className="booking-gate__options">
              <button
                className="booking-gate__option"
                onClick={() => navigate('/login', { state: { from: location.pathname + location.search } })}
              >
                <span className="booking-gate__option-title">Sign in</span>
                <span className="booking-gate__option-desc">Use your existing account</span>
              </button>
              <button
                className="booking-gate__option"
                onClick={() => navigate('/signup', { state: { from: location.pathname + location.search } })}
              >
                <span className="booking-gate__option-title">Create account</span>
                <span className="booking-gate__option-desc">Save your info for next time</span>
              </button>
              <button
                className="booking-gate__option booking-gate__option--ghost"
                onClick={() => setGuestMode(true)}
              >
                <span className="booking-gate__option-title">Continue as guest</span>
                <span className="booking-gate__option-desc">No account needed</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────────

  const showProgress = steps.length > 1;

  return (
    <div className="avail-modal-overlay" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className={`avail-modal booking-modal${showProgress ? ' booking-modal--wizard' : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        <div className="booking-modal__header">
          <button className="avail-modal__close" onClick={onClose} aria-label="Close">×</button>
          <h3 id="booking-modal-title" className="avail-modal__title">Book Appointment</h3>
          <p className="booking-modal__slot-summary">
            {formatDate(date)} · {formatTime(slot.startTime)}
          </p>

          {showProgress && (
            <nav className="booking-wizard-progress" aria-label="Booking progress">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={`booking-wizard-step${i === stepIndex ? ' booking-wizard-step--active' : i < stepIndex ? ' booking-wizard-step--done' : ''}`}
                >
                  <div className="booking-wizard-step__dot" aria-hidden="true">
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <span className="booking-wizard-step__label">{STEP_LABELS[s]}</span>
                </div>
              ))}
            </nav>
          )}
        </div>

        {/* ── Step: Contact ──────────────────────────────────────────────────── */}
        {currentStep === 'contact' && (
          <form className="booking-modal__step" onSubmit={handleContactNext} noValidate>
            <div className="booking-modal__body">
              <p className="booking-step-desc">
                We&apos;ll send your booking confirmation to this email.
              </p>

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

              <div className="booking-divider">Mailing Address</div>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-addr1">Street address</label>
                <input
                  id="bm-addr1"
                  className="booking-field__input"
                  type="text"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  disabled={submitting}
                  autoComplete="address-line1"
                  required
                />
              </div>
              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-addr2">
                  Apt, suite, etc. <span className="booking-field__optional">(optional)</span>
                </label>
                <input
                  id="bm-addr2"
                  className="booking-field__input"
                  type="text"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  disabled={submitting}
                  autoComplete="address-line2"
                />
              </div>
              <div className="booking-field-row">
                <div className="booking-field booking-field--grow">
                  <label className="booking-field__label" htmlFor="bm-city">City</label>
                  <input
                    id="bm-city"
                    className="booking-field__input"
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    disabled={submitting}
                    autoComplete="address-level2"
                    required
                  />
                </div>
                <div className="booking-field booking-field--state">
                  <label className="booking-field__label" htmlFor="bm-state">State</label>
                  <input
                    id="bm-state"
                    className="booking-field__input"
                    type="text"
                    value={addressState}
                    onChange={e => setAddressState(e.target.value)}
                    disabled={submitting}
                    autoComplete="address-level1"
                    maxLength={2}
                    placeholder="CA"
                    required
                  />
                </div>
                <div className="booking-field booking-field--zip">
                  <label className="booking-field__label" htmlFor="bm-zip">ZIP code</label>
                  <input
                    id="bm-zip"
                    className="booking-field__input"
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value)}
                    disabled={submitting}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="booking-modal__footer">
              {error && <p className="avail-modal__error" role="alert">{error}</p>}
              <div className="avail-modal__actions">
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={submitting || verifyingAddress || !isContactReady}
                >
                  {verifyingAddress ? 'Verifying address…' : 'Continue →'}
                </button>
                <button className="btn btn--ghost" type="button" onClick={onClose} disabled={submitting || verifyingAddress}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Step: Address (logged-in user, travel mode, no address on file) ── */}
        {currentStep === 'address' && (
          <form className="booking-modal__step" onSubmit={handleAddressNext} noValidate>
            <div className="booking-modal__body">
              <p className="booking-step-desc">
                Because this is a travel massage, we need your service address to confirm you&apos;re within our coverage area.
              </p>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-addr1">Street address</label>
                <input
                  id="bm-addr1"
                  className="booking-field__input"
                  type="text"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  disabled={submitting}
                  autoComplete="address-line1"
                  required
                />
              </div>
              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-addr2">
                  Apt, suite, etc. <span className="booking-field__optional">(optional)</span>
                </label>
                <input
                  id="bm-addr2"
                  className="booking-field__input"
                  type="text"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  disabled={submitting}
                  autoComplete="address-line2"
                />
              </div>
              <div className="booking-field-row">
                <div className="booking-field booking-field--grow">
                  <label className="booking-field__label" htmlFor="bm-city">City</label>
                  <input
                    id="bm-city"
                    className="booking-field__input"
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    disabled={submitting}
                    autoComplete="address-level2"
                    required
                  />
                </div>
                <div className="booking-field booking-field--state">
                  <label className="booking-field__label" htmlFor="bm-state">State</label>
                  <input
                    id="bm-state"
                    className="booking-field__input"
                    type="text"
                    value={addressState}
                    onChange={e => setAddressState(e.target.value)}
                    disabled={submitting}
                    autoComplete="address-level1"
                    maxLength={2}
                    placeholder="MA"
                    required
                  />
                </div>
                <div className="booking-field booking-field--zip">
                  <label className="booking-field__label" htmlFor="bm-zip">ZIP code</label>
                  <input
                    id="bm-zip"
                    className="booking-field__input"
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value)}
                    disabled={submitting}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="booking-modal__footer">
              {error && <p className="avail-modal__error" role="alert">{error}</p>}
              <div className="avail-modal__actions">
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={submitting || verifyingAddress || !isAddressReady}
                >
                  {verifyingAddress ? 'Verifying address…' : 'Continue →'}
                </button>
                <button className="btn btn--ghost" type="button" onClick={onClose} disabled={submitting || verifyingAddress}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Step: Health ───────────────────────────────────────────────────── */}
        {currentStep === 'health' && (
          <form className="booking-modal__step" onSubmit={handleHealthNext} noValidate>
            <div className="booking-modal__body">
              <p className="booking-step-desc">
                This information helps your therapist provide the safest and most effective session.
                All fields are optional.
              </p>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-dob">
                  Date of birth{' '}
                  {restrictions?.restrict_minors
                    ? <span className="booking-field__required">*</span>
                    : <span className="booking-field__optional">(optional)</span>
                  }
                </label>
                <input
                  type="date"
                  id="bm-dob"
                  className="booking-field__input"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  disabled={submitting}
                  max={new Date().toISOString().slice(0, 10)}
                  required={!!restrictions?.restrict_minors}
                />
              </div>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-medications">
                  Current medications <span className="booking-field__optional">(optional)</span>
                </label>
                <textarea
                  id="bm-medications"
                  className="booking-field__input booking-field__input--textarea"
                  value={medications}
                  onChange={e => setMedications(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  placeholder="List any medications you are currently taking"
                />
              </div>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-surgeries">
                  Recent surgeries <span className="booking-field__optional">(optional)</span>
                </label>
                <textarea
                  id="bm-surgeries"
                  className="booking-field__input booking-field__input--textarea"
                  value={surgeries}
                  onChange={e => setSurgeries(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  placeholder="Any surgeries in the past 12 months"
                />
              </div>

              <div className="booking-field">
                <span className="booking-field__label">Pregnancy status</span>
                <div className="booking-pregnancy-options">
                  {PREGNANCY_OPTIONS.map(opt => (
                    <label key={opt.value} className="booking-radio-option">
                      <input
                        type="radio"
                        name="pregnancyStatus"
                        value={opt.value}
                        checked={pregnancyStatus === opt.value}
                        onChange={() => setPregnancyStatus(opt.value)}
                        disabled={submitting}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-injuries">
                  Injuries or physical limitations <span className="booking-field__optional">(optional)</span>
                </label>
                <textarea
                  id="bm-injuries"
                  className="booking-field__input booking-field__input--textarea"
                  value={injuries}
                  onChange={e => setInjuries(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  placeholder="Any injuries, chronic pain, or physical limitations"
                />
              </div>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-notes">
                  Reason for your visit <span className="booking-field__optional">(optional)</span>
                </label>
                <textarea
                  id="bm-notes"
                  className="booking-field__input booking-field__input--textarea"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={submitting}
                  rows={3}
                  placeholder="What brings you in today? Areas of focus, specific concerns, or goals for this session."
                />
              </div>
            </div>

            <div className="booking-modal__footer">
              {error && <p className="avail-modal__error" role="alert">{error}</p>}
              <div className="avail-modal__actions">
                <button className="btn btn--primary" type="submit" disabled={submitting}>
                  Continue →
                </button>
                <button className="btn btn--ghost" type="button" onClick={stepIndex > 0 ? goBack : onClose} disabled={submitting}>
                  {stepIndex > 0 ? 'Back' : 'Cancel'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Step: Consent ──────────────────────────────────────────────────── */}
        {currentStep === 'consent' && (
          <div className="booking-modal__step">
            <div className="booking-modal__body">
              <div className="waiver-scroll" role="region" aria-label="Consent form text">
                <ol className="waiver-list">
                  {(travelModeEnabled ? [...WAIVER_ITEMS, TRAVEL_WAIVER_ITEM] : WAIVER_ITEMS).map((item, i) => (
                    <li key={i} className="waiver-list__item">{item}</li>
                  ))}
                </ol>
                <p className="waiver-closing">{WAIVER_CLOSING}</p>

                <div className="waiver-services">
                  <h3 className="waiver-services__heading">Services We Offer</h3>
                  <ul className="waiver-services__list">
                    {ALL_SERVICES.map(s => (
                      <li key={s.name} className="waiver-services__item">
                        <span className="waiver-services__name">{s.name}</span>
                        <span className="waiver-services__description"> — {s.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="waiver-cancellation">
                  <h3 className="waiver-cancellation__heading">Cancellation &amp; Appointment Policy</h3>
                  <p className="waiver-cancellation__text">{CANCELLATION_POLICY.commitment}</p>
                  <p className="waiver-cancellation__text">{CANCELLATION_POLICY.notice}</p>
                  <p className="waiver-cancellation__text">{CANCELLATION_POLICY.charge}</p>
                  <p className="waiver-cancellation__subheading">This policy applies to:</p>
                  <ul className="waiver-cancellation__list">
                    {CANCELLATION_POLICY.applies.map((item, i) => (
                      <li key={i} className="waiver-cancellation__item">{item}</li>
                    ))}
                  </ul>
                  <p className="waiver-cancellation__subheading">Exceptions</p>
                  <p className="waiver-cancellation__text">{CANCELLATION_POLICY.exceptionsNote}</p>
                  <ul className="waiver-cancellation__list">
                    {CANCELLATION_POLICY.exceptions.map((item, i) => (
                      <li key={i} className="waiver-cancellation__item">{item}</li>
                    ))}
                  </ul>
                  <p className="waiver-cancellation__subheading">Card-on-File Authorization</p>
                  <ul className="waiver-cancellation__list">
                    {CANCELLATION_POLICY.cardOnFile.map((item, i) => (
                      <li key={i} className="waiver-cancellation__item">{item}</li>
                    ))}
                  </ul>
                </div>
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

              <label className="waiver-agree">
                <input
                  type="checkbox"
                  className="waiver-agree__checkbox"
                  checked={cancellationAgreed}
                  onChange={e => setCancellationAgreed(e.target.checked)}
                  disabled={submitting}
                />
                <span className="waiver-agree__text">
                  I have read and agree to the Cancellation &amp; Appointment Policy, and I authorize the practice to charge my card on file for late cancellations, reschedules, and no-shows
                </span>
              </label>
            </div>

            <div className="booking-modal__footer">
              {error && <p className="avail-modal__error" role="alert">{error}</p>}
              <div className="avail-modal__actions">
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={handleConsentNext}
                  disabled={!signature || !agreed || !cancellationAgreed || submitting}
                >
                  Continue →
                </button>
                <button className="btn btn--ghost" type="button" onClick={goBack} disabled={submitting}>
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Payment ──────────────────────────────────────────────────── */}
        {currentStep === 'payment' && (
          <form className="booking-modal__step" onSubmit={handlePaymentSubmit} noValidate>
            <div className="booking-modal__body">
              {isReturnClient && (
                <div className="booking-return-client">
                  <p className="booking-return-client__greeting">
                    Welcome back, {user.first_name}!
                  </p>
                  <div className="booking-return-client__badges">
                    {consentStatus?.signedAt && (
                      <span className="booking-return-client__badge">
                        Consent on file since {new Date(consentStatus.signedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    <span className="booking-return-client__badge">Medical history on file</span>
                  </div>
                </div>
              )}

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="bm-service">Service</label>
                <select
                  id="bm-service"
                  className="booking-field__input"
                  value={serviceId}
                  onChange={e => setServiceId(e.target.value)}
                  disabled={submitting}
                >
                  {compatibleServices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.durationMinutes} min — ${(s.priceCents / 100).toFixed(0)}
                    </option>
                  ))}
                </select>
              </div>

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

              {isReturnClient && (
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
                    placeholder="Any updates to your health condition, new concerns, or focus areas for this visit."
                  />
                </div>
              )}

              {!membershipCoversBooking && (
                <div className="booking-gift-card">
                  <p className="booking-gift-card__label">Have a gift card?</p>
                  {giftCardApplied ? (
                    <div className="booking-gift-card__applied">
                      <span className="booking-gift-card__applied-text">
                        Gift card applied — ${(Math.min(giftCardApplied.remainingBalanceCents, selectedService?.priceCents ?? 0) / 100).toFixed(0)} credit
                        {giftCardApplied.remainingBalanceCents > (selectedService?.priceCents ?? 0) && (
                          <> (${((giftCardApplied.remainingBalanceCents - (selectedService?.priceCents ?? 0)) / 100).toFixed(0)} will remain on the card)</>
                        )}
                      </span>
                      <button
                        type="button"
                        className="booking-gift-card__remove"
                        onClick={removeGiftCard}
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="booking-gift-card__input-row">
                      <input
                        type="text"
                        className="booking-gift-card__input"
                        placeholder="XXXX-XXXX-XXXX"
                        value={giftCardInput}
                        onChange={e => { setGiftCardInput(e.target.value.toUpperCase()); setGiftCardError(''); }}
                        disabled={submitting || giftCardLoading}
                        maxLength={14}
                        aria-label="Gift card code"
                      />
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={applyGiftCard}
                        disabled={!giftCardInput.trim() || submitting || giftCardLoading}
                      >
                        {giftCardLoading ? 'Checking…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {giftCardError && (
                    <p className="booking-gift-card__error" role="alert">{giftCardError}</p>
                  )}
                </div>
              )}

              {membershipCoversBooking ? (
                <div className="booking-membership-banner">
                  <span className="booking-membership-banner__icon">★</span>
                  <div>
                    <strong>Covered by {membershipStatus.planName}</strong>
                    <p className="booking-membership-banner__credits">
                      {membershipStatus.creditsRemaining} of {membershipStatus.creditsPerMonth} monthly session{membershipStatus.creditsPerMonth !== 1 ? 's' : ''} remaining — no payment required
                    </p>
                  </div>
                </div>
              ) : needsPayment ? (
                <>
                  <div className="booking-divider">
                    Card on File
                    {selectedService && (
                      <span className="booking-divider__amount">
                        Due at appointment: ${(selectedService.priceCents / 100).toFixed(0)}
                      </span>
                    )}
                  </div>

                  <p className="booking-payment-note booking-payment-note--card-on-file">
                    Your card will not be charged now. Payment is collected in-person after your session. Your card is saved only in case you miss your appointment without cancelling in advance.
                  </p>

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
                  Payment is collected in-person at time of service.
                </div>
              )}
            </div>

            <div className="booking-modal__footer">
              {error && <p className="avail-modal__error" role="alert">{error}</p>}
              <div className="avail-modal__actions">
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={submitting || (loadingMethods && needsPayment)}
                >
                  {submitting ? 'Booking…' : 'Book Appointment'}
                </button>
                {stepIndex > 0 ? (
                  <button className="btn btn--ghost" type="button" onClick={goBack} disabled={submitting}>
                    Back
                  </button>
                ) : (
                  <button className="btn btn--ghost" type="button" onClick={onClose} disabled={submitting}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Shell — fetches status data and wraps in <Elements> ───────────────────────

export default function BookingModal({
  slot, date, services, _allTherapists, lockedTherapist, onComplete, onClose,
}) {
  const { user } = useAuth();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(!!(user && stripePublishableKey));
  const [selectedMethodId, setSelectedMethodId] = useState(user ? '' : 'new');
  const [membershipStatus, setMembershipStatus] = useState(null);
  const [consentStatus, setConsentStatus] = useState(null);
  const [loadingConsent, setLoadingConsent] = useState(!!user);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(!!user);
  const [restrictions, setRestrictions] = useState(null);
  const [travelModeEnabled, setTravelModeEnabled] = useState(false);

  const therapistOptions = useMemo(() => {
    if (lockedTherapist) return [lockedTherapist];
    return slot.availableTherapists;
  }, [lockedTherapist, slot.availableTherapists]);

  useEffect(() => {
    bookingService.getBookingRestrictions()
      .then(data => setRestrictions(data))
      .catch(() => setRestrictions({ restrict_pregnancy: true, restrict_minors: true }));
  }, []);

  useEffect(() => {
    bookingService.getTravelSettings()
      .then(data => setTravelModeEnabled(!!data?.travel_mode_enabled))
      .catch(() => setTravelModeEnabled(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    // If loading states were already false (user was null at mount), re-arm them so
    // the BookingWizard init effect fires correctly once status data arrives.
    setLoadingHealth(true);
    setLoadingConsent(true);

    const fetches = [
      membershipService.getMyStatus().then(({ data }) => setMembershipStatus(data)),
      bookingService.getConsentStatus()
        .then(status => setConsentStatus(status))
        .catch(() => setConsentStatus({ hasSigned: false, signedAt: null }))
        .finally(() => setLoadingConsent(false)),
      bookingService.getHealthStatus()
        .then(status => setHealthStatus(status))
        .catch(() => setHealthStatus({ hasRecord: false }))
        .finally(() => setLoadingHealth(false)),
    ];

    if (stripePublishableKey) {
      fetches.push(
        paymentService.listPaymentMethods()
          .then(({ data }) => {
            setPaymentMethods(data.methods);
            const def = data.methods.find(m => m.is_default);
            if (def) setSelectedMethodId(def.id);
            else if (data.methods.length > 0) setSelectedMethodId(data.methods[0].id);
            else setSelectedMethodId('new');
          })
          .catch(() => setSelectedMethodId('new'))
          .finally(() => setLoadingMethods(false))
      );
    }

    Promise.allSettled(fetches);
  }, [user]);

  const stripePromise = getStripePromise();

  return (
    <Elements stripe={stripePromise}>
      <BookingWizard
        slot={slot}
        date={date}
        services={services}
        therapistOptions={therapistOptions}
        lockedTherapist={lockedTherapist}
        paymentMethods={paymentMethods}
        loadingMethods={loadingMethods}
        selectedMethodId={selectedMethodId}
        setSelectedMethodId={setSelectedMethodId}
        membershipStatus={membershipStatus}
        consentStatus={consentStatus}
        loadingConsent={loadingConsent}
        healthStatus={healthStatus}
        loadingHealth={loadingHealth}
        restrictions={restrictions}
        travelModeEnabled={travelModeEnabled}
        onClose={onClose}
        onComplete={onComplete}
      />
    </Elements>
  );
}
