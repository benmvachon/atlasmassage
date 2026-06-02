import { renderHook, act, waitFor } from '@testing-library/react';
import { useAsync } from '../../hooks/useAsync.js';

describe('useAsync', () => {
  it('starts in loading state and resolves with data', async () => {
    const asyncFn = jest.fn().mockResolvedValue('hello');
    const { result } = renderHook(() => useAsync(asyncFn, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('sets error when the async function rejects', async () => {
    const asyncFn = jest.fn().mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useAsync(asyncFn, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Fetch failed');
    expect(result.current.data).toBeUndefined();
  });

  it('uses fallback message when error has no message property', async () => {
    const asyncFn = jest.fn().mockRejectedValue('plain string error');
    const { result } = renderHook(() => useAsync(asyncFn, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Something went wrong.');
  });

  it('skips execution and starts not loading when skip=true', async () => {
    const asyncFn = jest.fn();
    const { result } = renderHook(() => useAsync(asyncFn, [], { skip: true }));

    expect(result.current.loading).toBe(false);
    expect(asyncFn).not.toHaveBeenCalled();
  });

  it('re-runs when reload() is called', async () => {
    const asyncFn = jest.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    const { result } = renderHook(() => useAsync(asyncFn, []));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('first');

    act(() => { result.current.reload(); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('second');
    expect(asyncFn).toHaveBeenCalledTimes(2);
  });

  it('re-runs when a dependency changes', async () => {
    let dep = 'a';
    const asyncFn = jest.fn().mockResolvedValue('data');
    const { result, rerender } = renderHook(() => useAsync(asyncFn, [dep]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    dep = 'b';
    rerender();
    await waitFor(() => expect(asyncFn).toHaveBeenCalledTimes(2));
  });
});
