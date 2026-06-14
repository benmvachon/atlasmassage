import { Link } from 'react-router-dom';

export default function GiftCardSuccessPage() {
  return (
    <div className="gift-card-success container">
      <div className="gift-card-success__inner">
        <div className="gift-card-success__icon" aria-hidden="true">✓</div>
        <h1 className="gift-card-success__title">Gift Card Purchased!</h1>
        <p className="gift-card-success__body">
          Your Atlas Bodywork gift card is on its way. Check your inbox (and the
          recipient&apos;s inbox) for an email with the code.
        </p>
        <p className="gift-card-success__body">
          The code can be entered in the <strong>Have a gift card?</strong> section
          during booking checkout.
        </p>
        <div className="gift-card-success__actions">
          <Link to="/booking" className="btn btn--primary">Book a Session</Link>
          <Link to="/gift-cards" className="btn btn--ghost">Buy Another</Link>
        </div>
      </div>
    </div>
  );
}
