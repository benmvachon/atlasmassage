import {
  renderEssayMarkdown,
  formatPublishedDate,
  toDateInputValue,
} from '../../utils/essayMarkdown.js';

// Parses the rendered HTML so assertions read against real nodes rather than
// substrings of markup.
function parse(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('renderEssayMarkdown', () => {
  it('returns empty output for empty input', () => {
    expect(renderEssayMarkdown('')).toEqual({ html: '', headings: [] });
    expect(renderEssayMarkdown('   ')).toEqual({ html: '', headings: [] });
    expect(renderEssayMarkdown(undefined)).toEqual({ html: '', headings: [] });
  });

  it('renders headings, paragraphs, bold and lists', () => {
    const { html } = renderEssayMarkdown(
      '## SECTION\n\nSome **bold** text.\n\n- one\n- two'
    );
    const el = parse(html);

    expect(el.querySelector('h2').textContent).toBe('SECTION');
    expect(el.querySelector('strong').textContent).toBe('bold');
    expect(el.querySelectorAll('li')).toHaveLength(2);
  });

  it('gives headings slugified ids and reports the outline', () => {
    const { headings } = renderEssayMarkdown(
      '## WHAT IS LOW BACK PAIN?\n\nText.\n\n### Anatomy\n\nMore.'
    );

    expect(headings).toEqual([
      { id: 'what-is-low-back-pain', text: 'WHAT IS LOW BACK PAIN?', level: 2 },
      { id: 'anatomy', text: 'Anatomy', level: 3 },
    ]);
  });

  it('de-duplicates ids when two headings share a title', () => {
    const { headings } = renderEssayMarkdown('## Pathology\n\na\n\n### Pathology\n\nb');
    expect(headings.map(h => h.id)).toEqual(['pathology', 'pathology-2']);
  });

  it('turns [^n] into a superscript link to the matching reference', () => {
    const { html } = renderEssayMarkdown(
      'Claim one.[^1]\n\n## References\n\n1. First source.\n2. Second source.'
    );
    const el = parse(html);

    const marker = el.querySelector('sup.essay__fnref');
    expect(marker.id).toBe('fnref-1');
    expect(marker.querySelector('a').getAttribute('href')).toBe('#ref-1');
  });

  it('ids the reference list items so citations resolve', () => {
    const { html } = renderEssayMarkdown(
      'A.[^1] B.[^2]\n\n## References\n\n1. First.\n2. Second.'
    );
    const el = parse(html);

    const items = el.querySelectorAll('ol.essay__references > li');
    expect(Array.from(items).map(li => li.id)).toEqual(['ref-1', 'ref-2']);
  });

  it('adds a backlink only for references that are actually cited', () => {
    const { html } = renderEssayMarkdown(
      'Only cites one.[^1]\n\n## References\n\n1. Cited.\n2. Never cited.'
    );
    const el = parse(html);

    expect(el.querySelector('#ref-1 .essay__ref-backlink')).not.toBeNull();
    expect(el.querySelector('#ref-2 .essay__ref-backlink')).toBeNull();
  });

  it('leaves an ordered list alone when there is no References heading', () => {
    const { html } = renderEssayMarkdown('## Steps\n\n1. First\n2. Second');
    const el = parse(html);

    expect(el.querySelector('ol.essay__references')).toBeNull();
    expect(el.querySelector('ol > li').id).toBe('');
  });

  it('strips script tags from the rendered output', () => {
    const { html } = renderEssayMarkdown('Hello\n\n<script>window.stolen = 1;</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('window.stolen');
  });

  it('strips inline event handlers', () => {
    const { html } = renderEssayMarkdown('<p onclick="alert(1)">Click me</p>');
    const el = parse(html);

    expect(el.querySelector('p').hasAttribute('onclick')).toBe(false);
  });
});

describe('formatPublishedDate', () => {
  it('formats a stored timestamp as a long date', () => {
    expect(formatPublishedDate('2026-07-29T00:00:00.000Z')).toBe('July 29, 2026');
  });

  // The API anchors published_at to midnight UTC, so formatting in local time
  // would show the previous day for anyone west of Greenwich.
  it('does not shift the date backwards in western timezones', () => {
    expect(formatPublishedDate('2026-01-01T00:00:00.000Z')).toBe('January 1, 2026');
  });

  it('returns an empty string for a missing or unparseable value', () => {
    expect(formatPublishedDate(null)).toBe('');
    expect(formatPublishedDate('')).toBe('');
    expect(formatPublishedDate('not a date')).toBe('');
  });
});

describe('toDateInputValue', () => {
  it('reduces a timestamp to the YYYY-MM-DD a date input expects', () => {
    expect(toDateInputValue('2026-07-29T00:00:00.000Z')).toBe('2026-07-29');
  });

  it('returns an empty string for a missing or unparseable value', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('nonsense')).toBe('');
  });
});
