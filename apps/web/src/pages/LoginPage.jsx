import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthCard from '../components/AuthCard.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFormState } from '../hooks/useFormState.js';

function validate({ email, password }) {
  const errors = {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!password) {
    errors.password = 'Password is required.';
  }
  return errors;
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';

  const {
    values, fieldErrors, apiError,
    submitting, handleChange, setFieldErrors, setApiError, setSubmitting,
  } = useFormState({ email: '', password: '' });

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate(values);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    setSubmitting(true);
    try {
      await login(values);
    } catch (err) {
      setApiError(err.message ?? 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      apiError={apiError}
      onSubmit={handleSubmit}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup">Create one</Link>
        </>
      }
    >
      <FormField
        label="Email address"
        id="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={handleChange}
        error={fieldErrors.email}
        disabled={submitting}
      />
      <FormField
        label="Password"
        id="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={handleChange}
        error={fieldErrors.password}
        disabled={submitting}
      />
      <div className="auth-card__actions">
        <Link to="/forgot-password" className="auth-card__forgot">
          Forgot password?
        </Link>
        <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </AuthCard>
  );
}
