import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useMembership } from '../context/MembershipContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import PageState from '../components/PageState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import MembershipModal from '../components/MembershipModal.jsx';
import { membershipService } from '../services/membershipService.js';

const BENEFITS = [
  {
    icon: '◆',
    title: 'Guaranteed Sessions',
    body: 'Credits are deposited each month so you always have a session ready when you need it.',
  },
  {
    icon: '◆',
    title: 'Better Value',
    body: 'Members pay less per session than walk-in rates. The more consistent you are, the more you save.',
  },
  {
    icon: '◆',
    title: 'Cancel Anytime',
    body: 'No long-term contracts. Pause or cancel your membership whenever your schedule changes.',
  },
];

function perSessionLabel(priceCents, creditsPerMonth) {
  return `$${Math.round(priceCents / creditsPerMonth / 100)} per session`;
}

export default function MembershipsPage() {
  const { user } = useAuth();
  const { activeMembership } = useMembership();
  const navigate = useNavigate();

  const { data: plans, loading: plansLoading, error: plansError } = useAsync(
    () => membershipService.getPlans().then(r => r.data.plans)
  );

  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [joinedPlan, setJoinedPlan]     = useState(null);

  function handleJoin(plan) {
    if (!user) {
      navigate('/login?redirect=/memberships');
      return;
    }
    setCheckoutPlan(plan);
  }

  return (
    <div className="memberships-page">

      {/* ── Hero ── */}
      <section className="memberships-hero">
        <div className="memberships-hero__inner container">
          <p className="memberships-hero__eyebrow">Atlas Bodywork Membership</p>
          <h1 className="memberships-hero__title">Make Self-Care a Habit</h1>
          <p className="memberships-hero__subtitle">
            Commit to your wellness with a monthly membership. Guaranteed sessions,
            better rates, and no long-term contracts.
          </p>
          <a href="#plans" className="btn btn--secondary memberships-hero__cta">View Plans</a>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="memberships-benefits">
        <div className="memberships-benefits__grid container">
          {BENEFITS.map(b => (
            <div key={b.title} className="memberships-benefit">
              <span className="memberships-benefit__icon" aria-hidden="true">{b.icon}</span>
              <h3 className="memberships-benefit__title">{b.title}</h3>
              <p className="memberships-benefit__body">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="memberships-plans" id="plans">
        <div className="container">
          <h2 className="memberships-plans__heading">Choose Your Plan</h2>
          <p className="memberships-plans__subheading">
            All plans include monthly session credits and the flexibility to cancel anytime.
          </p>

          {joinedPlan && (
            <div className="memberships-success" role="status">
              <span className="memberships-success__icon">✓</span>
              <div>
                <p className="memberships-success__title">Welcome to {joinedPlan.name}!</p>
                <p className="memberships-success__body">
                  Your first session credit is ready.{' '}
                  <Link to="/booking">Book your first appointment →</Link>
                </p>
              </div>
            </div>
          )}

          <PageState
            loading={plansLoading}
            error={plansError}
            empty={!plansLoading && !plansError && (plans?.length ?? 0) === 0}
            emptyMessage="No membership plans are currently available."
            loadingClass="memberships-plans__state"
            errorClass="memberships-plans__state memberships-plans__state--error"
            emptyClass="memberships-plans__state"
          />

          {!plansLoading && !plansError && (plans?.length ?? 0) > 0 && (
            <div className="memberships-plan-grid">
              {plans.map(plan => {
                const isCurrent   = activeMembership?.plan_id === plan.id;
                const hasOtherPlan = activeMembership && !isCurrent;

                return (
                  <article
                    key={plan.id}
                    className={`membership-plan${isCurrent ? ' membership-plan--current' : ''}`}
                  >
                    {isCurrent && <span className="membership-plan__badge">Your Plan</span>}

                    <h3 className="membership-plan__name">{plan.name}</h3>

                    <div className="membership-plan__pricing">
                      <span className="membership-plan__price">${Math.round(plan.price_monthly_cents / 100)}</span>
                      <span className="membership-plan__period">/month</span>
                    </div>

                    <ul className="membership-plan__details">
                      <li>{plan.credits_per_month} session{plan.credits_per_month !== 1 ? 's' : ''} / month</li>
                      <li>{perSessionLabel(plan.price_monthly_cents, plan.credits_per_month)}</li>
                    </ul>

                    {plan.description && <p className="membership-plan__desc">{plan.description}</p>}

                    <div className="membership-plan__footer">
                      {isCurrent ? (
                        <>
                          <div className="membership-plan__status-row">
                            <p className="membership-plan__active-note">You&rsquo;re subscribed.</p>
                            <StatusBadge status={activeMembership.status} />
                          </div>
                          <Link to="/settings" className="membership-plan__manage-link">
                            Manage in Settings →
                          </Link>
                        </>
                      ) : hasOtherPlan ? (
                        <p className="membership-plan__other-note">
                          You have an active membership.{' '}
                          <Link to="/settings">Manage in Settings →</Link>
                        </p>
                      ) : (
                        <>
                          <button
                            className="btn btn--primary membership-plan__cta"
                            onClick={() => handleJoin(plan)}
                          >
                            {user ? 'Join Now' : 'Get Started'}
                          </button>
                          {!user && (
                            <p className="membership-plan__auth-note">
                              <Link to="/login?redirect=/memberships">Sign in</Link>
                              {' or '}
                              <Link to="/signup?redirect=/memberships">create an account</Link>
                              {' to subscribe.'}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {checkoutPlan && (
        <MembershipModal
          initialPlan={checkoutPlan}
          activeMembership={activeMembership}
          onSuccess={() => { setJoinedPlan(checkoutPlan); setCheckoutPlan(null); }}
          onClose={() => setCheckoutPlan(null)}
        />
      )}

    </div>
  );
}
