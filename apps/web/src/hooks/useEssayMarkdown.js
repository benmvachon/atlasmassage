import { useMemo } from 'react';
import { renderEssayMarkdown } from '../utils/essayMarkdown.js';

/**
 * Memoizes essay Markdown rendering, so the owner dashboard's live preview
 * re-parses only when the text actually changes rather than on every keystroke
 * that leaves it untouched.
 *
 * @returns {{ html: string, headings: Array<{ id, text, level }> }}
 */
export function useEssayMarkdown(markdown) {
  return useMemo(() => renderEssayMarkdown(markdown), [markdown]);
}
