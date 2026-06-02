import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthCard from '../components/AuthCard.jsx';
import FormField from '../components/FormField.jsx';
import { useFormState } from '../hooks/useFormState.js';
import { isValidPassword } from '../utils/validation.js';
import { authService } from '../services/authService.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [done, setDone] = useState(false);
  const { values, fieldErrors, apiError, submitting, handleChange, setFieldErrors, setApiError, setSubmitting } =
    useFormState({ password: '', confirmPassword: '' });

  if (!token) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This link is missing a reset token. Please request a new one."
        footer={<Link to="/forgot-password">Request a new link</Link>}
      />
    );
  }

  if (done) {
    return (
      <AuthCard
        title="Password updated"
        subtitle="Your password has been changed. You can now sign in."
        footer={<Link to="/login">Sign in</Link>}
      />
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = {};
    if (!isValidPassword(values.password))         errors.password        = 'Password must be at least 8 characters.';
    if (values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSubmitting(true);
    try {
      await authService.resetPassword({ token, password: values.password });
      setDone(true);
    } catch (err) {
      setApiError(err.message ?? 'This link may have expired. Please request a new one.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a password at least 8 characters long."
      apiError={apiError}
      onSubmit={handleSubmit}
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <FormField
        label="New password" id="password" type="password" autoComplete="new-password"
        value={values.password} onChange={handleChange}
        error={fieldErrors.password} disabled={submitting}
      />
      <FormField
        label="Confirm new password" id="confirmPassword" type="password" autoComplete="new-password"
        value={values.confirmPassword} onChange={handleChange}
        error={fieldErrors.confirmPassword} disabled={submitting}
      />
      <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
        {submitting ? 'Updating…' : 'Update password'}
      </button>
    </AuthCard>
  );
}
