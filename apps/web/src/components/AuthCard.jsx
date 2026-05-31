export default function AuthCard({ title, subtitle, apiError, onSubmit, children, footer }) {
  return (
    <div className="auth-card">
      <div className="auth-card__header">
        <h1 className="auth-card__title">{title}</h1>
        {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
      </div>

      {apiError && (
        <p className="auth-card__api-error" role="alert">{apiError}</p>
      )}

      <form className="auth-card__form" onSubmit={onSubmit} noValidate>
        {children}
      </form>

      {footer && <div className="auth-card__footer">{footer}</div>}
    </div>
  );
}
