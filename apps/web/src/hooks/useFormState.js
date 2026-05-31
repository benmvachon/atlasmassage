import { useState } from 'react';

export function useFormState(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
    setApiError(null);
  }

  return {
    values,
    fieldErrors,
    apiError,
    submitting,
    handleChange,
    setFieldErrors,
    setApiError,
    setSubmitting,
  };
}
