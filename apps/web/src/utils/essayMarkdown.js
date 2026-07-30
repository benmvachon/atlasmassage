import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Renders essay Markdown for both the public reader and the owner dashboard's
// live preview, so what an author sees while editing is what readers get.
//
// Two conventions layer on top of plain Markdown:
//   [^N]           a citation marker, rendered as a superscript link to the
//                  matching entry in the references list
//   ## References  the ordered list that follows this heading is treated as the
//                  reference list; its items become the [^N] link targets

const FOOTNOTE_PATTERN = /\[\^(\d+)\]/g;

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isReferencesHeading(el) {
  return /^h[23]$/i.test(el.tagName) && /^references$/i.test(el.textContent.trim());
}

/**
 * @param {string} markdown
 * @returns {{ html: string, headings: Array<{ id: string, text: string, level: number }> }}
 */
export function renderEssayMarkdown(markdown) {
  if (!markdown || !markdown.trim()) return { html: '', headings: [] };

  // Citation markers become inline HTML before parsing so Markdown never sees
  // them as link syntax.
  const withFootnotes = markdown.replace(
    FOOTNOTE_PATTERN,
    (_match, n) =>
      `<sup class="essay__fnref" id="fnref-${n}"><a href="#ref-${n}" aria-label="Jump to reference ${n}">${n}</a></sup>`
  );

  const rawHtml = marked.parse(withFootnotes, { async: false, gfm: true, breaks: false });

  const clean = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['id', 'target', 'rel', 'aria-label'],
  });

  const doc = new DOMParser().parseFromString(`<div id="root">${clean}</div>`, 'text/html');
  const root = doc.getElementById('root');

  // Stable heading ids drive the in-page contents nav and deep links.
  const headings = [];
  const used = new Set();
  root.querySelectorAll('h2, h3').forEach(el => {
    const text = el.textContent.trim();
    let id = slugifyHeading(text) || 'section';
    let suffix = 2;
    while (used.has(id)) id = `${slugifyHeading(text)}-${suffix++}`;
    used.add(id);

    el.id = id;
    headings.push({ id, text, level: Number(el.tagName[1]) });
  });

  // Give the reference list items the ids the [^N] markers point at, and a link
  // back to where the citation was made.
  const referencesHeading = Array.from(root.children).find(isReferencesHeading);
  if (referencesHeading) {
    let node = referencesHeading.nextElementSibling;
    while (node && node.tagName !== 'OL') node = node.nextElementSibling;

    if (node) {
      node.classList.add('essay__references');
      Array.from(node.children).forEach((li, index) => {
        const n = index + 1;
        li.id = `ref-${n}`;
        if (root.querySelector(`#fnref-${n}`)) {
          const backLink = doc.createElement('a');
          backLink.className = 'essay__ref-backlink';
          backLink.href = `#fnref-${n}`;
          backLink.setAttribute('aria-label', `Back to citation ${n} in the text`);
          backLink.textContent = '↩';
          li.append(' ', backLink);
        }
      });
    }
  }

  return { html: root.innerHTML, headings };
}

// published_at is anchored to midnight UTC by the API, so it is formatted in UTC
// here — reading it in the viewer's zone would shift the date backwards for
// anyone west of Greenwich.
export function formatPublishedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// The <input type="date"> value for the owner dashboard, in the same UTC frame.
export function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
