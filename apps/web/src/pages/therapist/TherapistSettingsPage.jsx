import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService } from '../../services/userService.js';
import NotificationPrefsSection from '../../components/NotificationPrefsSection.jsx';

const SECTIONS = [
  { key: 'profile',       label: 'Profile'       },
  { key: 'security',      label: 'Security'       },
  { key: 'notifications', label: 'Notifications'  },
];

function ProfileSection({ user, onSaved }) {
  const [form, setForm] = useState({
    firstName: user?.first_name ?? '',
    lastName:  user?.last_name  ?? '',
    phone:     user?.phone      ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

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
            <input className="settings-input"
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              required disabled={saving} />
          </label>
          <label className="settings-label">
            Last name
            <input className="settings-input"
              value={form.lastName}
              onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              required disabled={saving} />
          </label>
        </div>
        <label className="settings-label">
          Email <span className="settings-muted">(cannot be changed)</span>
          <input className="settings-input" value={user?.email ?? ''} disabled />
        </label>
        <label className="settings-label">
          Phone <span className="settings-muted">(used for SMS notifications)</span>
          <input className="settings-input" type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Optional" disabled={saving} />
        </label>
        {error   && <p className="settings-error">{error}</p>}
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

function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

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
        newPassword:     form.newPassword,
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
          <input className="settings-input" type="password"
            value={form.currentPassword}
            onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
            required disabled={saving} />
        </label>
        <label className="settings-label">
          New password
          <input className="settings-input" type="password"
            value={form.newPassword}
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
            required minLength={8} disabled={saving} />
        </label>
        <label className="settings-label">
          Confirm new password
          <input className="settings-input" type="password"
            value={form.confirmPassword}
            onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            required disabled={saving} />
        </label>
        {error   && <p className="settings-error">{error}</p>}
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

export default function TherapistSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [section, setSection] = useState('notifications');

  return (
    <div className="settings-page">
      <nav className="settings-nav">
        <p className="settings-nav__heading">Settings</p>
        <ul className="settings-nav__list">
          {SECTIONS.map(s => (
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
        {section === 'profile' && <ProfileSection user={user} onSaved={refreshUser} />}
        {section === 'security' && <SecuritySection />}
        {section === 'notifications' && (
          <section className="settings-section">
            <h2 className="settings-section__title">Notifications</h2>
            <NotificationPrefsSection />
          </section>
        )}
      </div>
    </div>
  );
}
