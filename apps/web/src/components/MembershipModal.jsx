import { useState } from 'react';
import Modal from './Modal.jsx';
import PageState from './PageState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { membershipService } from '../services/membershipService.js';

function formatPrice(cents) {
  return `$${Math.round(cents / 100)}/mo`;
}

export default function MembershipModal({ activeMembership, onSubscribe, onClose }) {
  const { data: plans, loading, error } = useAsync(
    () => membershipService.getPlans().then(r => r.data.plans)
  );

  const [subscribing, setSubscribing] = useState(null);
  const [subscribeError, setSubscribeError] = useState('');

  async function handleSubscribe(planId) {
    setSubscribing(planId);
    setSubscribeError('');
    try {
      await onSubscribe(planId);
    } catch (err) {
      setSubscribeError(err.message || 'Subscription failed.');
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <Modal title="Choose a Membership Plan" onClose={onClose}>
      {loading && <p className="modal-loading">Loading plans…</p>}

      <PageState loading={false} error={error || subscribeError} />

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
    </Modal>
  );
}
