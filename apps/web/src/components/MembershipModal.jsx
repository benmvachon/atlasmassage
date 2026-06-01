import { useEffect, useState } from 'react';
import { membershipService } from '../services/membershipService.js';

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(0)}/mo`;
}

export default function MembershipModal({ activeMembership, onSubscribe, onClose }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    membershipService.getPlans()
      .then(({ data }) => setPlans(data.plans))
      .catch(() => setError('Failed to load plans.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubscribe(planId) {
    setSubscribing(planId);
    setError('');
    try {
      await onSubscribe(planId);
    } catch (err) {
      setError(err.message || 'Subscription failed.');
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Choose a Membership Plan</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading && <p className="modal-loading">Loading plans…</p>}

        {error && <p className="membership-modal__error">{error}</p>}

        {!loading && (
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
                  {plan.description && (
                    <p className="plan-card__desc">{plan.description}</p>
                  )}
                  {!isCurrent && !activeMembership && (
                    <button
                      className="btn btn--primary btn--full"
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={subscribing === plan.id}
                    >
                      {subscribing === plan.id ? 'Subscribing…' : 'Subscribe'}
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
      </div>
    </div>
  );
}
