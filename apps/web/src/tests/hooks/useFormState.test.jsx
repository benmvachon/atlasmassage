import { renderHook, act } from '@testing-library/react';
import { useFormState } from '../../hooks/useFormState.js';

const INITIAL = { email: '', password: '' };

describe('useFormState', () => {
  it('initializes with the provided values', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    expect(result.current.values).toEqual(INITIAL);
    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.apiError).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it('handleChange updates the changed field value', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => {
      result.current.handleChange({ target: { name: 'email', value: 'user@example.com' } });
    });
    expect(result.current.values.email).toBe('user@example.com');
    expect(result.current.values.password).toBe(''); // unchanged
  });

  it('handleChange clears the field error for that field', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => { result.current.setFieldErrors({ email: 'Invalid email' }); });
    act(() => { result.current.handleChange({ target: { name: 'email', value: 'x' } }); });
    expect(result.current.fieldErrors.email).toBeUndefined();
  });

  it('handleChange clears the API error', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => { result.current.setApiError('Server error'); });
    act(() => { result.current.handleChange({ target: { name: 'email', value: 'x' } }); });
    expect(result.current.apiError).toBeNull();
  });

  it('setFieldErrors replaces the field error map', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => { result.current.setFieldErrors({ email: 'Required', password: 'Too short' }); });
    expect(result.current.fieldErrors).toEqual({ email: 'Required', password: 'Too short' });
  });

  it('setApiError sets the API error message', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => { result.current.setApiError('Unauthorized'); });
    expect(result.current.apiError).toBe('Unauthorized');
  });

  it('setSubmitting controls the submitting flag', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => { result.current.setSubmitting(true); });
    expect(result.current.submitting).toBe(true);
    act(() => { result.current.setSubmitting(false); });
    expect(result.current.submitting).toBe(false);
  });

  it('does not clear field errors for other fields when one field changes', () => {
    const { result } = renderHook(() => useFormState(INITIAL));
    act(() => { result.current.setFieldErrors({ email: 'Bad', password: 'Short' }); });
    act(() => { result.current.handleChange({ target: { name: 'email', value: 'x@x.com' } }); });
    expect(result.current.fieldErrors.password).toBe('Short');
  });
});
