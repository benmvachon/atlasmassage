import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async function and tracks its loading / error / data state.
 *
 * @param {Function} asyncFn  Called to (re-)fetch. May close over local
 *   variables — the ref pattern ensures the latest version runs every time.
 * @param {Array}   deps      Re-runs the fetch whenever any dep changes,
 *   the same way a plain useEffect dep array works.
 * @param {Object}  opts
 * @param {boolean} opts.skip Set true to defer the first run (e.g. while a
 *   required dependency like `user` is still null). The hook re-runs as soon
 *   as skip becomes false.
 *
 * @returns {{ data, loading, error, reload }}
 */
export function useAsync(asyncFn, deps = [], { skip = false } = {}) {
  const [data, setData]       = useState(undefined);
  const [loading, setLoading] = useState(!skip);
  const [error, setError]     = useState(null);
  const [version, setVersion] = useState(0);

  // Always keep a current reference so stale closures never affect the call.
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  useEffect(() => {
    if (skip) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fnRef.current()
      .then(result => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          setError(err.message || 'Something went wrong.');
          setLoading(false);
        }
      });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, skip]);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  return { data, loading, error, reload };
}
