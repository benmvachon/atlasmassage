import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC',
  });
}

export default function GuestManagePage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const token = params.get('token');

  const [appt, setAppt] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!id || !token) {
      setLoadError('This link is invalid or has expired.');
      setLoading(false);
      return;
    }
    api.get(`/appointments/${id}/guest?token=${encodeURIComponent(token)}`)
      .then(r => setAppt(r.data))
      .catch(() => setLoadError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.post(`/appointments/${id}/cancel`, { cancelToken: token });
      setCancelled(true);
      setConfirming(false);
    } catch (err) {
      setCancelError(err.response?.data?.message || err.message || 'Something went wrong. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  const alreadyCancelled = appt?.status === 'cancelled';
  const withinWindow = appt && new Date(appt.scheduledAt) <= new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <div className="feedback-page">
      <div className="feedback-card">
        <div className="feedback-card__logo">Atlas Bodywork</div>

        {loading && <p className="feedback-card__loading">Loading&hellip;</p>}

        {loadError && (
          <div className="feedback-card__error">
            <p>{loadError}</p>
          </div>
        )}

        {!loading && !loadError && (cancelled || alreadyCancelled) && (
          <div className="feedback-card__thanks">
            <div className="feedback-card__check" aria-hidden="true">✓</div>
            <h2>Appointment cancelled</h2>
            <p>Your appointment has been cancelled. We hope to see you again soon.</p>
          </div>
        )}

        {!loading && !loadError && appt && !cancelled && !alreadyCancelled && (
          <>
            <h1 className="feedback-card__title">Manage your appointment</h1>

            <div className="guest-manage-card">
              <div className="guest-manage-card__row">
                <span className="guest-manage-card__label">Service</span>
                <span>{appt.serviceName}</span>
              </div>
              <div className="guest-manage-card__row">
                <span className="guest-manage-card__label">Therapist</span>
                <span>{appt.therapistFirstName} {appt.therapistLastName}</span>
              </div>
              <div className="guest-manage-card__row">
                <span className="guest-manage-card__label">Date</span>
                <span>{formatDate(appt.scheduledAt)}</span>
              </div>
              <div className="guest-manage-card__row">
                <span className="guest-manage-card__label">Time</span>
                <span>{formatTime(appt.scheduledAt)}</span>
              </div>
            </div>

            {withinWindow ? (
              <p className="guest-manage-card__window-notice">
                Appointments cannot be cancelled within 24 hours of the scheduled time. Please call us directly if you need assistance.
              </p>
            ) : confirming ? (
              <div className="guest-manage-card__confirm">
                <p>Are you sure you want to cancel this appointment?</p>
                {cancelError && <p className="feedback-card__error-inline" role="alert">{cancelError}</p>}
                <div className="guest-manage-card__confirm-actions">
                  <button
                    className="btn btn--danger"
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                  </button>
                  <button
                    className="btn btn--secondary"
                    onClick={() => { setConfirming(false); setCancelError(null); }}
                    disabled={cancelling}
                  >
                    Keep appointment
                  </button>
                </div>
              </div>
            ) : (
              <button className="btn btn--danger feedback-card__submit" onClick={() => setConfirming(true)}>
                Cancel appointment
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
