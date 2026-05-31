export default function FormField({ label, id, error, className = '', ...inputProps }) {
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}${className ? ` ${className}` : ''}`}>
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <input className="form-field__input" id={id} name={id} {...inputProps} />
      {error && <span className="form-field__error" role="alert">{error}</span>}
    </div>
  );
}
