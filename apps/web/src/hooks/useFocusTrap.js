import { useEffect } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(ref, { onEscape } = {}) {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement;
    const focusable = container.querySelectorAll(FOCUSABLE_SELECTORS);
    if (focusable.length) focusable[0].focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape') { onEscape?.(); return; }
      if (e.key !== 'Tab') return;

      const els = [...container.querySelectorAll(FOCUSABLE_SELECTORS)];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [ref, onEscape]);
}
