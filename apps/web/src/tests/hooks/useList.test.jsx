import { renderHook, act } from '@testing-library/react';
import { useList } from '../../hooks/useList.js';

const ITEMS = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

describe('useList', () => {
  it('initializes with the provided array', () => {
    const { result } = renderHook(() => useList(ITEMS));
    expect(result.current.items).toEqual(ITEMS);
  });

  it('defaults to an empty array', () => {
    const { result } = renderHook(() => useList());
    expect(result.current.items).toEqual([]);
  });

  it('add appends an item to the list', () => {
    const { result } = renderHook(() => useList(ITEMS));
    act(() => { result.current.add({ id: 3, name: 'Carol' }); });
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[2]).toEqual({ id: 3, name: 'Carol' });
  });

  it('removeById removes the item with the matching id', () => {
    const { result } = renderHook(() => useList(ITEMS));
    act(() => { result.current.removeById(1); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe(2);
  });

  it('removeById does nothing when the id is not found', () => {
    const { result } = renderHook(() => useList(ITEMS));
    act(() => { result.current.removeById(99); });
    expect(result.current.items).toHaveLength(2);
  });

  it('updateById patches the item with matching id', () => {
    const { result } = renderHook(() => useList(ITEMS));
    act(() => { result.current.updateById(1, { name: 'Alex' }); });
    expect(result.current.items[0]).toEqual({ id: 1, name: 'Alex' });
    expect(result.current.items[1]).toEqual(ITEMS[1]); // unchanged
  });

  it('reset replaces the entire list', () => {
    const { result } = renderHook(() => useList(ITEMS));
    act(() => { result.current.reset([{ id: 9, name: 'Zed' }]); });
    expect(result.current.items).toEqual([{ id: 9, name: 'Zed' }]);
  });
});
