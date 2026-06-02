import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { notificationService } from '../services/notificationService.js';

function Toggle({ id, label, description, checked, onChange, disabled }) {
  return (
    <label className="notif-toggle" htmlFor={id}>
      <div className="notif-toggle__text">
        <span className="notif-toggle__label">{label}</span>
        {description && <span className="notif-toggle__desc">{description}</span>}
      </div>
      <div className={`notif-toggle__switch${checked ? ' notif-toggle__switch--on' : ''}`}>
        <input
          id={id}
          type="checkbox"
          className="notif-toggle__input"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className="notif-toggle__thumb" />
      </div>
    </label>
  );
}

export default function NotificationPrefsSection() {
  const { user } = useAuth();
  const hasPhone = !!user?.phone;

  const { data: loadedPrefs, loading, error: loadError } = useAsync(
    () => notificationService.getPreferences().then(r => r.data.preferences)
  );

  const [prefs, setPrefs]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState(false);

  // Sync local editable state from the async load once.
  const effectivePrefs = prefs ?? loadedPrefs;

  function setField(field, value) {
    setPrefs(p => ({ ...(p ?? loadedPrefs), [field]: value }));
    setSuccess(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!effectivePrefs) return;
    setSaving(true);
    setSaveError('');
    setSuccess(false);
    try {
      const { data } = await notificationService.updatePreferences({
        emailAppointmentRemind: effectivePrefs.email_appointment_remind,
        emailBookingConfirm:    effectivePrefs.email_booking_confirm,
        smsAppointmentRemind:   effectivePrefs.sms_appointment_remind,
        smsBookingConfirm:      effectivePrefs.sms_booking_confirm,
      });
      setPrefs(data.preferences);
      setSuccess(true);
    } catch (err) {
      setSaveError(err.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="settings-muted">Loading preferences…</p>;
  if (loadError) return <p className="settings-error" role="alert">{loadError}</p>;
  if (!effectivePrefs) return null;

  return (
    <form className="notif-prefs" onSubmit={handleSave}>
      <div className="notif-group">
        <h3 className="notif-group__heading">Email</h3>
        <div className="notif-group__items">
          <Toggle
            id="email-confirm"
            label="Booking confirmations"
            description="Receive an email when an appointment is booked."
            checked={effectivePrefs.email_booking_confirm}
            onChange={v => setField('email_booking_confirm', v)}
            disabled={saving}
          />
          <Toggle
            id="email-remind"
            label="Appointment reminders"
            description="Receive a reminder email 24 hours before each appointment."
            checked={effectivePrefs.email_appointment_remind}
            onChange={v => setField('email_appointment_remind', v)}
            disabled={saving}
          />
        </div>
      </div>

      <div className="notif-group">
        <h3 className="notif-group__heading">SMS</h3>
        {!hasPhone && (
          <p className="notif-group__notice">
            Add a phone number to your profile to enable SMS notifications.
          </p>
        )}
        <div className={`notif-group__items${!hasPhone ? ' notif-group__items--muted' : ''}`}>
          <Toggle
            id="sms-confirm"
            label="Booking confirmations"
            description="Receive a text when an appointment is booked."
            checked={effectivePrefs.sms_booking_confirm}
            onChange={v => setField('sms_booking_confirm', v)}
            disabled={saving || !hasPhone}
          />
          <Toggle
            id="sms-remind"
            label="Appointment reminders"
            description="Receive a text reminder 24 hours before each appointment."
            checked={effectivePrefs.sms_appointment_remind}
            onChange={v => setField('sms_appointment_remind', v)}
            disabled={saving || !hasPhone}
          />
        </div>
      </div>

      {saveError && <p className="settings-error">{saveError}</p>}
      {success   && <p className="settings-success">Preferences saved.</p>}

      <div>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}
