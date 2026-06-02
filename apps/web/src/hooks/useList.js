import { useCallback, useState } from 'react';

/**
 * Manages an array with stable, named mutation helpers.
 * Avoids repeating inline filter/map transforms at call sites.
 */
export function useList(initial = []) {
  const [items, setItems] = useState(initial);

  const reset      = useCallback(next => setItems(next), []);
  const add        = useCallback(item => setItems(prev => [...prev, item]), []);
  const removeById = useCallback(id   => setItems(prev => prev.filter(item => item.id !== id)), []);
  const updateById = useCallback((id, patch) =>
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item)), []);

  return { items, setItems, reset, add, removeById, updateById };
}
