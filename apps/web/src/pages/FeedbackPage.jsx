import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="feedback-stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`feedback-star${active >= n ? ' feedback-star--on' : ''}`}
          aria-label={`${n} star${n !== 1 ? 's' : ''}`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const token = params.get('token');

  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id || !token) {
      setLoadError('This feedback link is invalid or has expired.');
      setLoading(false);
      return;
    }
    api.get(`/appointments/${id}/feedback-info?token=${encodeURIComponent(token)}`)
      .then(r => {
        setInfo(r.data.data);
        if (r.data.data.alreadySubmitted) setSubmitted(true);
      })
      .catch(() => setLoadError('This feedback link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) { setSubmitError('Please select a star rating.'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/appointments/${id}/feedback`, {
        feedbackToken: token,
        rating,
        comments: comments.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="feedback-page">
      <div className="feedback-card">
        <div className="feedback-card__logo">Atlas Bodywork</div>

        {loading && <p className="feedback-card__loading">Loading…</p>}

        {loadError && (
          <div className="feedback-card__error">
            <p>{loadError}</p>
          </div>
        )}

        {!loading && !loadError && submitted && (
          <div className="feedback-card__thanks">
            <div className="feedback-card__check" aria-hidden="true">✓</div>
            <h2>Thank you for your feedback!</h2>
            <p>We appreciate you taking the time to share your experience. It helps us continue to improve.</p>
          </div>
        )}

        {!loading && !loadError && !submitted && info && (
          <>
            <h1 className="feedback-card__title">How was your visit?</h1>
            {info.scheduledAt && (
              <p className="feedback-card__session">
                {info.serviceName} &mdash; {formatDate(info.scheduledAt)}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="feedback-field">
                <label className="feedback-field__label">Your rating</label>
                <StarRating value={rating} onChange={setRating} />
              </div>

              <div className="feedback-field">
                <label className="feedback-field__label" htmlFor="fb-comments">
                  Comments <span className="feedback-field__optional">(optional)</span>
                </label>
                <textarea
                  id="fb-comments"
                  className="feedback-field__input"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={4}
                  placeholder="Tell us about your experience…"
                  disabled={submitting}
                />
              </div>

              {submitError && <p className="feedback-card__error-inline" role="alert">{submitError}</p>}

              <button
                className="btn btn--primary feedback-card__submit"
                type="submit"
                disabled={submitting || rating === 0}
              >
                {submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
