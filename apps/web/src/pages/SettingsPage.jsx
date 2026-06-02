import { useEffect, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext.jsx';
import { userService } from '../services/userService.js';
import { paymentService } from '../services/paymentService.js';
import { membershipService } from '../services/membershipService.js';
import { getStripePromise, stripePublishableKey } from '../services/stripe.js';
import MembershipModal from '../components/MembershipModal.jsx';
import NotificationPrefsSection from '../components/NotificationPrefsSection.jsx';

const ALL_SECTIONS = [
  { key: 'profile',       label: 'Profile',          clientOnly: false },
  { key: 'security',      label: 'Security',          clientOnly: false },
  { key: 'notifications', label: 'Notifications',     clientOnly: false },
  { key: 'membership',    label: 'Membership',        clientOnly: true  },
  { key: 'payment',       label: 'Payment Methods',   clientOnly: true  },
];

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '16px',
      color: '#1a1a2e',
      '::placeholder': { color: '#6b7280' },
    },
    invalid: { color: '#dc2626' },
  },
};

// ── Add card form (must be inside <Elements>) ─────────────────────────────────

function AddCardForm({ onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');
    try {
      const { data } = await paymentService.createSetupIntent();
      const cardElement = elements.getElement(CardElement);

      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        data.clientSecret,
        { payment_method: { card: cardElement } }
      );
      if (stripeError) throw new Error(stripeError.message);

      await paymentService.addPaymentMethod(setupIntent.payment_method);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to add card.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="settings-add-card" onSubmit={handleSubmit}>
      <div className="settings-card-element">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      {error && <p className="settings-error">{error}</p>}
      <div className="settings-row settings-row--gap">
        <button type="submit" className="btn btn--primary btn--sm" disabled={loading || !stripe}>
          {loading ? 'Saving…' : 'Save Card'}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ user, onSaved }) {
  const [form, setForm] = useState({
    firstName: user?.first_name ?? '',
    lastName: user?.last_name ?? '',
    phone: user?.phone ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await userService.updateMe(form);
      await onSaved();
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Profile</h2>
      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-fields settings-fields--two-col">
          <label className="settings-label">
            First name
            <input
              className="settings-input"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              required
            />
          </label>
          <label className="settings-label">
            Last name
            <input
              className="settings-input"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              required
            />
          </label>
        </div>
        <label className="settings-label">
          Email <span className="settings-muted">(cannot be changed)</span>
          <input className="settings-input" value={user?.email ?? ''} disabled />
        </label>
        <label className="settings-label">
          Phone
          <input
            className="settings-input"
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Optional"
          />
        </label>
        {error && <p className="settings-error">{error}</p>}
        {success && <p className="settings-success">Profile updated.</p>}
        <div>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Security section ──────────────────────────────────────────────────────────

function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await userService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Change Password</h2>
      <form className="settings-form" onSubmit={handleSubmit}>
        <label className="settings-label">
          Current password
          <input
            className="settings-input"
            type="password"
            value={form.currentPassword}
            onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
            required
          />
        </label>
        <label className="settings-label">
          New password
          <input
            className="settings-input"
            type="password"
            value={form.newPassword}
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            required
            minLength={8}
          />
        </label>
        <label className="settings-label">
          Confirm new password
          <input
            className="settings-input"
            type="password"
            value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            required
          />
        </label>
        {error && <p className="settings-error">{error}</p>}
        {success && <p className="settings-success">Password updated successfully.</p>}
        <div>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Membership section ────────────────────────────────────────────────────────

function MembershipSection() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const activeMembership = memberships.find(m => m.status === 'active') ?? null;

  function loadMemberships() {
    return membershipService.getMyMemberships()
      .then(({ data }) => setMemberships(data.memberships))
      .catch(() => setError('Failed to load membership.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (user) loadMemberships(); }, [user]);

  async function handleSubscribe(planId) {
    await membershipService.subscribe(planId);
    setShowModal(false);
    setLoading(true);
    await loadMemberships();
  }

  async function handleCancel() {
    if (!activeMembership) return;
    if (!window.confirm('Cancel your membership? You will retain access until the end of the current billing period.')) return;
    setCancelling(true);
    setError('');
    try {
      await membershipService.cancel(activeMembership.id);
      setLoading(true);
      await loadMemberships();
    } catch (err) {
      setError(err.message || 'Failed to cancel membership.');
    } finally {
      setCancelling(false);
    }
  }

  const statusColor = {
    active: 'settings-badge--active',
    paused: 'settings-badge--paused',
    cancelled: 'settings-badge--cancelled',
    expired: 'settings-badge--cancelled',
  };

  return (
    <section className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">Membership</h2>
        {!activeMembership && !loading && (
          <button className="btn btn--outline btn--sm" onClick={() => setShowModal(true)}>
            View Plans
          </button>
        )}
      </div>

      {loading && <p className="settings-muted">Loading…</p>}
      {error && <p className="settings-error">{error}</p>}

      {!loading && !activeMembership && (
        <div className="settings-empty">
          <p>You don&apos;t have an active membership.</p>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            Choose a Plan
          </button>
        </div>
      )}

      {activeMembership && (
        <div className="membership-status">
          <div className="membership-status__plan">
            <span className="membership-status__name">{activeMembership.plan_name}</span>
            <span className={`settings-badge ${statusColor[activeMembership.status] ?? ''}`}>
              {activeMembership.status}
            </span>
          </div>
          <dl className="membership-status__details">
            <div>
              <dt>Price</dt>
              <dd>${(activeMembership.price_monthly_cents / 100).toFixed(0)}/month</dd>
            </div>
            <div>
              <dt>Credits remaining</dt>
              <dd>{activeMembership.credits_remaining}</dd>
            </div>
            <div>
              <dt>Member since</dt>
              <dd>{new Date(activeMembership.start_date).toLocaleDateString()}</dd>
            </div>
          </dl>
          {activeMembership.status === 'active' && (
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: 'var(--color-error, #dc2626)' }}
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel Membership'}
            </button>
          )}
        </div>
      )}

      {showModal && (
        <MembershipModal
          activeMembership={activeMembership}
          onSubscribe={handleSubscribe}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
}

// ── Payment methods section ───────────────────────────────────────────────────

function PaymentMethodsSection() {
  const { user } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [settingDefault, setSettingDefault] = useState(null);
  const [error, setError] = useState('');

  const stripePromise = getStripePromise();

  function loadMethods() {
    return paymentService.listPaymentMethods()
      .then(({ data }) => setMethods(data.methods))
      .catch(() => setError('Failed to load payment methods.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (user) loadMethods(); }, [user]);

  async function handleRemove(id) {
    if (!window.confirm('Remove this card?')) return;
    setRemoving(id);
    setError('');
    try {
      await paymentService.removePaymentMethod(id);
      setMethods(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove card.');
    } finally {
      setRemoving(null);
    }
  }

  async function handleSetDefault(id) {
    setSettingDefault(id);
    setError('');
    try {
      await paymentService.setDefault(id);
      setMethods(prev =>
        prev.map(m => ({ ...m, is_default: m.id === id }))
      );
    } catch (err) {
      setError(err.message || 'Failed to update default.');
    } finally {
      setSettingDefault(null);
    }
  }

  async function handleCardAdded() {
    setShowAddCard(false);
    setLoading(true);
    await loadMethods();
  }

  const brandIcon = (brand) => ({
    visa: '💳 Visa',
    mastercard: '💳 Mastercard',
    amex: '💳 Amex',
    discover: '💳 Discover',
  }[brand] ?? '💳 Card');

  return (
    <section className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">Payment Methods</h2>
        {stripePublishableKey && !showAddCard && (
          <button className="btn btn--outline btn--sm" onClick={() => setShowAddCard(true)}>
            + Add Card
          </button>
        )}
      </div>

      {!stripePublishableKey && (
        <p className="settings-muted">
          Payment processing is not configured in this environment.
          Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to enable card management.
        </p>
      )}

      {loading && <p className="settings-muted">Loading…</p>}
      {error && <p className="settings-error">{error}</p>}

      {!loading && methods.length === 0 && stripePublishableKey && !showAddCard && (
        <p className="settings-empty">No cards saved.</p>
      )}

      {methods.map(pm => (
        <div key={pm.id} className={`payment-card${pm.is_default ? ' payment-card--default' : ''}`}>
          <div className="payment-card__info">
            <span className="payment-card__brand">{brandIcon(pm.brand)}</span>
            <span className="payment-card__number">•••• {pm.last4}</span>
            <span className="payment-card__expiry">
              {String(pm.expiry_month).padStart(2, '0')}/{pm.expiry_year}
            </span>
            {pm.is_default && <span className="settings-badge settings-badge--active">Default</span>}
          </div>
          <div className="payment-card__actions">
            {!pm.is_default && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => handleSetDefault(pm.id)}
                disabled={settingDefault === pm.id}
              >
                {settingDefault === pm.id ? '…' : 'Set Default'}
              </button>
            )}
            <button
              className="btn btn--ghost btn--sm btn--danger-text"
              onClick={() => handleRemove(pm.id)}
              disabled={removing === pm.id}
            >
              {removing === pm.id ? '…' : 'Remove'}
            </button>
          </div>
        </div>
      ))}

      {showAddCard && stripePublishableKey && stripePromise && (
        <Elements stripe={stripePromise}>
          <AddCardForm onSuccess={handleCardAdded} onCancel={() => setShowAddCard(false)} />
        </Elements>
      )}
    </section>
  );
}

// ── Root settings page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [section, setSection] = useState('profile');

  const isClient = user?.roles?.includes('client');
  const sections = ALL_SECTIONS.filter(s => !s.clientOnly || isClient);

  return (
    <div className="settings-page">
      <nav className="settings-nav">
        <p className="settings-nav__heading">Account</p>
        <ul className="settings-nav__list">
          {sections.map(s => (
            <li key={s.key}>
              <button
                className={`settings-nav__link${section === s.key ? ' settings-nav__link--active' : ''}`}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="settings-content">
        {section === 'profile' && (
          <ProfileSection user={user} onSaved={refreshUser} />
        )}
        {section === 'security' && <SecuritySection />}
        {section === 'notifications' && (
          <section className="settings-section">
            <h2 className="settings-section__title">Notifications</h2>
            <NotificationPrefsSection />
          </section>
        )}
        {section === 'membership' && <MembershipSection />}
        {section === 'payment' && <PaymentMethodsSection />}
      </div>
    </div>
  );
}
