import { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Modal from './Modal.jsx';
import PageState from './PageState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { membershipService } from '../services/membershipService.js';
import { paymentService } from '../services/paymentService.js';
import { getStripePromise, stripePublishableKey } from '../services/stripe.js';
import { useMembership } from '../context/MembershipContext.jsx';

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

function brandLabel(brand) {
  return { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' }[brand] ?? 'Card';
}

function formatPrice(cents) {
  return `$${Math.round(cents / 100)}/mo`;
}

// ── Plan selection step ────────────────────────────────────────────────────────

function PlanStep({ activeMembership, onSelect }) {
  const { data: plans, loading, error } = useAsync(
    () => membershipService.getPlans().then(r => r.data.plans)
  );

  return (
    <>
      <PageState loading={loading} error={error} />
      {!loading && plans && (
        <div className="plan-cards">
          {plans.map(plan => {
            const isCurrent = activeMembership?.plan_id === plan.id;
            return (
              <div key={plan.id} className={`plan-card${isCurrent ? ' plan-card--current' : ''}`}>
                {isCurrent && <span className="plan-card__badge">Current Plan</span>}
                <h3 className="plan-card__name">{plan.name}</h3>
                <p className="plan-card__price">{formatPrice(plan.price_monthly_cents)}</p>
                <p className="plan-card__credits">
                  {plan.credits_per_month} massage{plan.credits_per_month !== 1 ? 's' : ''} / month
                </p>
                {plan.description && <p className="plan-card__desc">{plan.description}</p>}
                {!isCurrent && !activeMembership && (
                  <button
                    className="btn btn--primary btn--full"
                    onClick={() => onSelect(plan)}
                  >
                    Select
                  </button>
                )}
                {isCurrent && (
                  <p className="plan-card__active-note">You are subscribed to this plan.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Payment step (must be inside <Elements>) ───────────────────────────────────

function PaymentStep({ plan, onBack, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const { subscribe } = useMembership();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState('new');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const requiresPayment = !!stripePublishableKey;

  useEffect(() => {
    if (!requiresPayment) return;
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
  }, [requiresPayment]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      let paymentMethodId;
      if (requiresPayment) {
        if (selectedMethodId === 'new') {
          if (!stripe || !elements) throw new Error('Payment processing unavailable.');
          const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
            type: 'card',
            card: elements.getElement(CardElement),
          });
          if (pmError) throw new Error(pmError.message);
          paymentMethodId = paymentMethod.id;
        } else {
          const saved = paymentMethods.find(m => m.id === selectedMethodId);
          paymentMethodId = saved?.stripe_payment_method_id;
        }
      }
      await subscribe(plan.id, paymentMethodId);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Subscription failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="membership-checkout__plan">
        <span className="membership-checkout__plan-name">{plan.name}</span>
        <span className="membership-checkout__plan-price">{formatPrice(plan.price_monthly_cents)}</span>
        <span className="membership-checkout__plan-credits">
          {plan.credits_per_month} session{plan.credits_per_month !== 1 ? 's' : ''}/month
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {requiresPayment ? (
          <>
            <div className="booking-divider">Payment Method</div>
            {loadingMethods ? (
              <p className="booking-payment-loading">Loading saved cards…</p>
            ) : (
              <div className="booking-payment-options">
                {paymentMethods.map(pm => (
                  <label
                    key={pm.id}
                    className={`booking-pm-option${selectedMethodId === pm.id ? ' booking-pm-option--selected' : ''}`}
                  >
                    <input
                      type="radio" name="pm" value={pm.id}
                      checked={selectedMethodId === pm.id}
                      onChange={() => setSelectedMethodId(pm.id)}
                      disabled={submitting}
                    />
                    <span className="booking-pm-option__brand">{brandLabel(pm.brand)}</span>
                    <span className="booking-pm-option__number">•••• {pm.last4}</span>
                    <span className="booking-pm-option__expiry">
                      {String(pm.expiry_month).padStart(2, '0')}/{pm.expiry_year}
                    </span>
                    {pm.is_default && <span className="booking-pm-option__badge">Default</span>}
                  </label>
                ))}
                <label className={`booking-pm-option${selectedMethodId === 'new' ? ' booking-pm-option--selected' : ''}`}>
                  <input
                    type="radio" name="pm" value="new"
                    checked={selectedMethodId === 'new'}
                    onChange={() => setSelectedMethodId('new')}
                    disabled={submitting}
                  />
                  <span className="booking-pm-option__brand">Enter a new card</span>
                </label>
                {selectedMethodId === 'new' && (
                  <div className="booking-card-element">
                    <CardElement options={CARD_STYLE} />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="plan-card__no-payment">
            Payment processing is not configured — payment will be collected separately.
          </p>
        )}

        {error && <p className="plan-card__error">{error}</p>}

        <div className="modal-actions">
          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting || loadingMethods}
          >
            {submitting ? 'Subscribing…' : 'Subscribe'}
          </button>
          {onBack && (
            <button type="button" className="btn btn--ghost" onClick={onBack} disabled={submitting}>
              ← Back to Plans
            </button>
          )}
        </div>
      </form>
    </>
  );
}

// ── Outer shell ────────────────────────────────────────────────────────────────

export default function MembershipModal({ initialPlan, activeMembership, onSuccess, onClose }) {
  const stripePromise = getStripePromise();
  const [selectedPlan, setSelectedPlan] = useState(initialPlan ?? null);

  const title = selectedPlan ? 'Subscribe to Membership' : 'Choose a Membership Plan';

  return (
    <Modal title={title} onClose={onClose}>
      <Elements stripe={stripePromise}>
        {selectedPlan ? (
          <PaymentStep
            plan={selectedPlan}
            onBack={initialPlan ? null : () => setSelectedPlan(null)}
            onSuccess={onSuccess}
          />
        ) : (
          <PlanStep
            activeMembership={activeMembership}
            onSelect={setSelectedPlan}
          />
        )}
      </Elements>
    </Modal>
  );
}
