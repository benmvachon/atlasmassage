import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthCard from '../components/AuthCard.jsx';
import FormField from '../components/FormField.jsx';
import { useFormState } from '../hooks/useFormState.js';
import { isValidEmail } from '../utils/validation.js';
import { authService } from '../services/authService.js';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { values, fieldErrors, apiError, submitting, handleChange, setFieldErrors, setApiError, setSubmitting } =
    useFormState({ email: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValidEmail(values.email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }
    setSubmitting(true);
    try {
      await authService.forgotPassword({ email: values.email });
      setSent(true);
    } catch {
      setApiError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        subtitle="If that address is registered, we've sent a reset link. It expires in 1 hour."
        footer={<Link to="/login">Back to sign in</Link>}
      />
    );
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your email and we'll send you a reset link."
      apiError={apiError}
      onSubmit={handleSubmit}
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <FormField
        label="Email address" id="email" type="email" autoComplete="email"
        value={values.email} onChange={handleChange}
        error={fieldErrors.email} disabled={submitting}
      />
      <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>
    </AuthCard>
  );
}
