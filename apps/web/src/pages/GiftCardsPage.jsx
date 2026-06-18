import { useState } from 'react';
import { giftCardService } from '../services/giftCardService.js';
import { useAuth } from '../context/AuthContext.jsx';

const PRESET_AMOUNTS = [150, 200, 250, 300];

export default function GiftCardsPage() {
  const { user } = useAuth();

  const [selectedAmount, setSelectedAmount] = useState(150);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const [purchaserName, setPurchaserName] = useState(
    user ? `${user.first_name} ${user.last_name}` : ''
  );
  const [purchaserEmail, setPurchaserEmail] = useState(user?.email ?? '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const amountCents = useCustom
    ? Math.round(parseFloat(customAmount || '0') * 100)
    : selectedAmount * 100;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!purchaserName.trim()) { setError('Your name is required.'); return; }
    if (!purchaserEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail)) {
      setError('A valid email address is required.'); return;
    }
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      setError('Recipient email address is not valid.'); return;
    }
    if (useCustom) {
      const val = parseFloat(customAmount);
      if (isNaN(val) || val < 150 || val > 500) {
        setError('Custom amount must be between $150 and $500.'); return;
      }
    }

    setSubmitting(true);
    try {
      const { url } = await giftCardService.purchase({
        purchaserName: purchaserName.trim(),
        purchaserEmail: purchaserEmail.trim(),
        recipientName: recipientName.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
        message: message.trim() || undefined,
        amountCents,
      });
      window.location.href = url;
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to start checkout. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--gift-cards container">
      <div className="page--gift-cards__hero">
        <h1 className="page--gift-cards__title">Give the Gift of Wellness</h1>
        <p className="page--gift-cards__subtitle">
          Atlas Bodywork gift cards are the kindest way to tell somebody they need a massage.
        </p>
      </div>

      <div className="page--gift-cards__layout">
        <form className="gift-card-form" onSubmit={handleSubmit} noValidate>
          <section className="gift-card-form__section">
            <h2 className="gift-card-form__section-title">Choose an amount</h2>
            <div className="gift-card-amounts">
              {PRESET_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  className={`gift-card-amount-btn${!useCustom && selectedAmount === amt ? ' gift-card-amount-btn--selected' : ''}`}
                  onClick={() => { setSelectedAmount(amt); setUseCustom(false); }}
                  disabled={submitting}
                >
                  ${amt}
                </button>
              ))}
              <button
                type="button"
                className={`gift-card-amount-btn${useCustom ? ' gift-card-amount-btn--selected' : ''}`}
                onClick={() => setUseCustom(true)}
                disabled={submitting}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <div className="gift-card-custom-amount">
                <label className="gift-card-custom-amount__label" htmlFor="gc-custom">
                  Amount ($150–$500)
                </label>
                <div className="gift-card-custom-amount__input-wrap">
                  <span className="gift-card-custom-amount__prefix">$</span>
                  <input
                    id="gc-custom"
                    type="number"
                    min="150"
                    max="500"
                    step="1"
                    className="gift-card-custom-amount__input"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    disabled={submitting}
                    placeholder="75"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="gift-card-form__section">
            <h2 className="gift-card-form__section-title">Your information</h2>
            <div className="gift-card-form__field">
              <label htmlFor="gc-purchaser-name">Your name</label>
              <input
                id="gc-purchaser-name"
                type="text"
                value={purchaserName}
                onChange={e => setPurchaserName(e.target.value)}
                disabled={submitting}
                autoComplete="name"
                required
              />
            </div>
            <div className="gift-card-form__field">
              <label htmlFor="gc-purchaser-email">Your email</label>
              <input
                id="gc-purchaser-email"
                type="email"
                value={purchaserEmail}
                onChange={e => setPurchaserEmail(e.target.value)}
                disabled={submitting}
                autoComplete="email"
                required
              />
            </div>
          </section>

          <section className="gift-card-form__section">
            <h2 className="gift-card-form__section-title">
              Recipient <span className="gift-card-form__optional">(optional)</span>
            </h2>
            <p className="gift-card-form__section-desc">
              Leave blank to receive the code yourself, or fill this in to send it directly to someone else.
            </p>
            <div className="gift-card-form__field">
              <label htmlFor="gc-recipient-name">Recipient name</label>
              <input
                id="gc-recipient-name"
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <div className="gift-card-form__field">
              <label htmlFor="gc-recipient-email">Recipient email</label>
              <input
                id="gc-recipient-email"
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <div className="gift-card-form__field">
              <label htmlFor="gc-message">
                Personal message <span className="gift-card-form__optional">(optional)</span>
              </label>
              <textarea
                id="gc-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="Enjoy some well-deserved care!"
              />
            </div>
          </section>

          {error && <p className="gift-card-form__error" role="alert">{error}</p>}

          <div className="gift-card-form__submit">
            <button
              type="submit"
              className="btn btn--primary btn--lg"
              disabled={submitting || (useCustom && !customAmount)}
            >
              {submitting
                ? 'Redirecting to checkout…'
                : `Purchase ${useCustom && customAmount ? `$${parseFloat(customAmount || 0).toFixed(0)}` : `$${selectedAmount}`} Gift Card`}
            </button>
          </div>

          <p className="gift-card-form__secure-note">
            Payments are processed securely by Stripe. Gift cards do not expire.
          </p>
        </form>

        <aside className="page--gift-cards__info">
          <div className="gift-card-info-card">
            <h3>How it works</h3>
            <ol className="gift-card-info-steps">
              <li>Choose an amount and complete checkout.</li>
              <li>The gift card code is emailed instantly — to you or directly to the recipient.</li>
              <li>Redeem by entering the code in the booking flow.</li>
            </ol>
          </div>
          <div className="gift-card-info-card">
            <h3>Details</h3>
            <ul className="gift-card-info-details">
              <li>No expiry date</li>
              <li>Covers any massage service</li>
              <li>Partial balances carry over</li>
              <li>Not redeemable for cash</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
