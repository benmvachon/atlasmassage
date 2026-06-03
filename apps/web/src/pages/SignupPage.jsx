import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFormState } from '../hooks/useFormState.js';
import { isValidEmail, isValidPassword, isNonEmpty } from '../utils/validation.js';

function validate({ firstName, lastName, email, password }) {
  const errors = {};
  if (!isNonEmpty(firstName))   errors.firstName = 'First name is required.';
  if (!isNonEmpty(lastName))    errors.lastName  = 'Last name is required.';
  if (!isValidEmail(email))     errors.email     = 'Please enter a valid email address.';
  if (!isValidPassword(password)) errors.password = 'Password must be at least 8 characters.';
  return errors;
}

export default function SignupPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get('redirect');
  const { values, fieldErrors, apiError, submitting, handleChange, setFieldErrors, setApiError, setSubmitting } =
    useFormState({ firstName: '', lastName: '', email: '', password: '' });

  useEffect(() => {
    if (user) navigate(redirectTo ?? '/', { replace: true });
  }, [user, navigate, redirectTo]);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(values);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSubmitting(true);
    try {
      await register(values);
    } catch (err) {
      setApiError(err.message ?? 'Could not create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create an account"
      subtitle="Book and manage your appointments."
      apiError={apiError}
      onSubmit={handleSubmit}
      footer={<>Already have an account? <Link to={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}>Sign in</Link></>}
    >
      <div className="auth-card__row">
        <FormField
          label="First name" id="firstName" type="text" autoComplete="given-name"
          value={values.firstName} onChange={handleChange}
          error={fieldErrors.firstName} disabled={submitting}
        />
        <FormField
          label="Last name" id="lastName" type="text" autoComplete="family-name"
          value={values.lastName} onChange={handleChange}
          error={fieldErrors.lastName} disabled={submitting}
        />
      </div>
      <FormField
        label="Email address" id="email" type="email" autoComplete="email"
        value={values.email} onChange={handleChange}
        error={fieldErrors.email} disabled={submitting}
      />
      <FormField
        label="Password" id="password" type="password" autoComplete="new-password"
        value={values.password} onChange={handleChange}
        error={fieldErrors.password} disabled={submitting}
      />
      <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </button>
    </AuthCard>
  );
}
