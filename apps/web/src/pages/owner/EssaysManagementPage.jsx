import { useEffect, useRef, useState } from 'react';
import { adminService } from '../../services/adminService.js';
import { useEssayMarkdown } from '../../hooks/useEssayMarkdown.js';
import { formatPublishedDate, toDateInputValue } from '../../utils/essayMarkdown.js';
import EssayBody from '../../components/EssayBody.jsx';

const EMPTY_FORM = {
  title: '',
  slug: '',
  subtitle: '',
  author: 'Ben Vachon, LMT',
  summary: '',
  heroImageAlt: '',
  bodyMarkdown: '',
  isPublished: false,
  publishedAt: '',
};

const MARKDOWN_PLACEHOLDER = `Opening paragraph — this is the lede readers see first.

## WHAT IS THIS CONDITION?

Body text. Cite a source with a footnote marker like this.[^1]

### A Subsection

More detail here.

- a bullet
- another bullet

## References

1. Author Name. Title of the paper. *Journal.* Year. doi: ...`;

function formatBytes(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// ── Markdown editor with live preview ─────────────────────────────────────────

function MarkdownEditor({ value, onChange }) {
  const { html } = useEssayMarkdown(value);

  return (
    <div className="essay-editor">
      <div className="essay-editor__pane">
        <div className="essay-editor__pane-header">
          <span>Markdown</span>
          <span className="essay-editor__hint">
            <code>##</code> section · <code>###</code> subsection · <code>[^1]</code> citation
          </span>
        </div>
        <textarea
          className="essay-editor__textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={MARKDOWN_PLACEHOLDER}
          spellCheck
          aria-label="Essay body in Markdown"
        />
      </div>

      <div className="essay-editor__pane">
        <div className="essay-editor__pane-header">
          <span>Preview</span>
        </div>
        <div className="essay-editor__preview">
          {value.trim()
            ? <EssayBody html={html} />
            : <p className="essay-editor__preview-empty">Nothing to preview yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Hero image ────────────────────────────────────────────────────────────────
// Uploading needs an essay id, so this only appears once an essay exists.

function HeroImagePanel({ essay, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const res = await adminService.uploadEssayHeroImage(essay.id, file);
      onUploaded(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="essay-hero">
      <div className="essay-hero__status">
        <span className="owner-label__text">Hero image</span>
        {essay.hero_image_path ? (
          <img
            className="essay-hero__preview"
            src={essay.hero_image_path}
            alt={essay.hero_image_alt || ''}
          />
        ) : (
          <p className="essay-hero__none">
            No image yet — the reader and the index card show text only.
          </p>
        )}
        <p className="essay-hero__note">JPEG, PNG, or WebP, up to 8&nbsp;MB.</p>
      </div>

      <div className="essay-hero__actions">
        <input
          ref={inputRef}
          id={`essay-hero-${essay.id}`}
          className="essay-hero__input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          disabled={uploading}
        />
        <label htmlFor={`essay-hero-${essay.id}`} className="btn btn--outline btn--sm">
          {uploading ? 'Uploading…' : essay.hero_image_path ? 'Replace image' : 'Upload image'}
        </label>
      </div>

      {error && <p className="owner-form-error">{error}</p>}
    </div>
  );
}

// ── PDF attachment ────────────────────────────────────────────────────────────
// Uploading needs an essay id, so this only appears once an essay exists.

function PdfPanel({ essay, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const res = await adminService.uploadEssayPdf(essay.id, file);
      onUploaded(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="essay-pdf">
      <div className="essay-pdf__status">
        <span className="owner-label__text">Downloadable PDF</span>
        {essay.pdf_path ? (
          <p className="essay-pdf__current">
            <strong>{essay.pdf_filename}</strong>
            {essay.pdf_size_bytes ? ` · ${formatBytes(essay.pdf_size_bytes)}` : ''}
          </p>
        ) : (
          <p className="essay-pdf__current essay-pdf__current--none">
            No PDF attached — the download button is hidden from readers.
          </p>
        )}
        <p className="essay-pdf__note">
          The PDF is a separate file from the text above. Editing the Markdown does not
          change it — re-upload when you want the download to match.
        </p>
      </div>

      <div className="essay-pdf__actions">
        <input
          ref={inputRef}
          id={`essay-pdf-${essay.id}`}
          className="essay-pdf__input"
          type="file"
          accept="application/pdf"
          onChange={handleFile}
          disabled={uploading}
        />
        <label htmlFor={`essay-pdf-${essay.id}`} className="btn btn--outline btn--sm">
          {uploading ? 'Uploading…' : essay.pdf_path ? 'Replace PDF' : 'Upload PDF'}
        </label>
      </div>

      {error && <p className="owner-form-error">{error}</p>}
    </div>
  );
}

// ── Essay form ────────────────────────────────────────────────────────────────

function EssayForm({
  initial, essay, onSave, onCancel, onPdfUploaded, onHeroImageUploaded, submitLabel,
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="essay-form">
      <div className="essay-form__row">
        <label className="owner-label">
          Title *
          <input
            className="owner-input"
            required
            maxLength={200}
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. PLANTAR FASCIITIS"
          />
        </label>

        <label className="owner-label">
          URL slug
          <input
            className="owner-input"
            maxLength={120}
            value={form.slug}
            onChange={set('slug')}
            placeholder="derived from the title"
            pattern="[a-z0-9\-]*"
          />
          <span className="owner-label__hint">
            /pathology/{form.slug || '…'}
          </span>
        </label>
      </div>

      <label className="owner-label">
        Subtitle
        <input
          className="owner-input"
          maxLength={300}
          value={form.subtitle}
          onChange={set('subtitle')}
          placeholder="e.g. Can Massage Therapy Help Heel Pain?"
        />
      </label>

      <label className="owner-label">
        Author
        <input
          className="owner-input"
          maxLength={120}
          value={form.author}
          onChange={set('author')}
        />
      </label>

      <label className="owner-label">
        Summary
        <textarea
          className="owner-textarea"
          rows={3}
          value={form.summary}
          onChange={set('summary')}
          placeholder="The teaser shown on the /pathology index."
        />
      </label>

      <label className="owner-label">
        Hero image alt text
        <input
          className="owner-input"
          maxLength={300}
          value={form.heroImageAlt}
          onChange={set('heroImageAlt')}
          placeholder="Describe the image for screen readers"
        />
      </label>

      {essay && <HeroImagePanel essay={essay} onUploaded={onHeroImageUploaded} />}

      <div className="owner-label">
        Essay body *
        <MarkdownEditor
          value={form.bodyMarkdown}
          onChange={v => setForm(f => ({ ...f, bodyMarkdown: v }))}
        />
      </div>

      {essay && <PdfPanel essay={essay} onUploaded={onPdfUploaded} />}

      <div className="essay-form__row">
        <label className="owner-toggle">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))}
          />
          <span className="owner-toggle__label">
            Published — visible at /pathology
          </span>
        </label>

        <label className="owner-label">
          Published date
          <input
            className="owner-input owner-input--sm"
            type="date"
            value={form.publishedAt}
            onChange={set('publishedAt')}
          />
          <span className="owner-label__hint">
            Shown on the essay and the index. Leave empty to hide the date.
          </span>
        </label>
      </div>

      {error && <p className="owner-form-error">{error}</p>}

      <div className="essay-form__actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function EssayRow({ essay, index, total, onEdit, onDelete, onMove, reordering }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${essay.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await adminService.deleteEssay(essay.id);
      onDelete(essay.id);
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  return (
    <tr className={!essay.is_published ? 'owner-row--inactive' : ''}>
      <td className="essay-table__order">
        <div className="essay-table__move">
          <button
            type="button"
            className="essay-table__move-btn"
            onClick={() => onMove(index, -1)}
            disabled={index === 0 || reordering}
            aria-label={`Move "${essay.title}" up`}
          >
            ▲
          </button>
          <span className="essay-table__position">{index + 1}</span>
          <button
            type="button"
            className="essay-table__move-btn"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1 || reordering}
            aria-label={`Move "${essay.title}" down`}
          >
            ▼
          </button>
        </div>
      </td>

      <td>
        <span className="essay-table__title">{essay.title}</span>
        {essay.subtitle && <span className="essay-table__subtitle">{essay.subtitle}</span>}
        <span className="essay-table__slug">/pathology/{essay.slug}</span>
      </td>

      <td className="essay-table__pdf">
        {essay.pdf_path
          ? <span className="owner-badge owner-badge--active">PDF</span>
          : <span className="essay-table__no-pdf">—</span>}
      </td>

      <td>
        <span className={`owner-badge ${essay.is_published ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {essay.is_published ? 'Published' : 'Draft'}
        </span>
        {essay.published_at && (
          <span className="essay-table__date">
            {formatPublishedDate(essay.published_at)}
          </span>
        )}
      </td>

      <td className="owner-table__actions">
        <button className="btn btn--outline btn--sm" onClick={() => onEdit(essay)}>
          Edit
        </button>
        <button className="btn btn--danger btn--sm" onClick={handleDelete} disabled={deleting}>
          Delete
        </button>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EssaysManagementPage() {
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    adminService.listEssays()
      .then(res => setEssays(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(form) {
    const res = await adminService.createEssay(form);
    setEssays(prev => [...prev, res.data]);
    setShowAdd(false);
  }

  async function handleSave(form) {
    const res = await adminService.updateEssay(editing.id, form);
    setEssays(prev => prev.map(e => (e.id === editing.id ? res.data : e)));
    setEditing(null);
  }

  function handleDelete(id) {
    setEssays(prev => prev.filter(e => e.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  // Optimistic swap, reverted if the server rejects the new order.
  async function handleMove(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= essays.length) return;

    const previous = essays;
    const next = [...essays];
    [next[index], next[target]] = [next[target], next[index]];
    setEssays(next);
    setReordering(true);

    try {
      const res = await adminService.reorderEssays(next.map(e => e.id));
      setEssays(res.data);
    } catch (err) {
      setEssays(previous);
      alert(err.message);
    } finally {
      setReordering(false);
    }
  }

  // Shared by the PDF and hero-image uploads — both return the whole essay.
  function handleEssayUpdated(updated) {
    setEssays(prev => prev.map(e => (e.id === updated.id ? updated : e)));
    setEditing(cur => (cur?.id === updated.id ? updated : cur));
  }

  if (loading) return <div className="page owner-loading">Loading…</div>;
  if (error) return <div className="page owner-error">Error: {error}</div>;

  const published = essays.filter(e => e.is_published).length;

  return (
    <div className="page owner-page">
      <h1 className="owner-page__title">Essays</h1>

      <section className="owner-section">
        <div className="owner-section__header">
          <div>
            <p className="owner-section__meta">
              {essays.length} total · {published} published · shown at{' '}
              <a href="/pathology" target="_blank" rel="noreferrer">/pathology</a>
            </p>
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => { setShowAdd(s => !s); setEditing(null); }}
          >
            {showAdd ? 'Cancel' : 'New Essay'}
          </button>
        </div>

        {showAdd && (
          <div className="owner-edit-panel">
            <h3 className="owner-edit-panel__title">New Essay</h3>
            <p className="owner-edit-panel__note">
              Save the essay first, then add its hero image and downloadable PDF from the
              edit form.
            </p>
            <EssayForm
              initial={EMPTY_FORM}
              essay={null}
              onSave={handleAdd}
              onCancel={() => setShowAdd(false)}
              submitLabel="Create Essay"
            />
          </div>
        )}

        {editing && (
          <div className="owner-edit-panel">
            <h3 className="owner-edit-panel__title">Edit: {editing.title}</h3>
            <EssayForm
              key={editing.id}
              initial={{
                title: editing.title,
                slug: editing.slug,
                subtitle: editing.subtitle ?? '',
                author: editing.author ?? '',
                summary: editing.summary ?? '',
                heroImageAlt: editing.hero_image_alt ?? '',
                bodyMarkdown: editing.body_markdown ?? '',
                isPublished: editing.is_published,
                publishedAt: toDateInputValue(editing.published_at),
              }}
              essay={editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              onPdfUploaded={handleEssayUpdated}
              onHeroImageUploaded={handleEssayUpdated}
              submitLabel="Save Changes"
            />
          </div>
        )}

        {essays.length === 0 ? (
          <p className="owner-empty">No essays yet. Create one above.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Essay</th>
                  <th>PDF</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {essays.map((essay, i) => (
                  <EssayRow
                    key={essay.id}
                    essay={essay}
                    index={i}
                    total={essays.length}
                    reordering={reordering}
                    onEdit={e => { setEditing(e); setShowAdd(false); }}
                    onDelete={handleDelete}
                    onMove={handleMove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
