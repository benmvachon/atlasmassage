import { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService.js';

const EMPTY_FORM = {
  authorName: '',
  body: '',
  rating: '',
  isPublished: true,
  displayOrder: 0,
};

// ── Star rating picker ────────────────────────────────────────────────────────

function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`star-picker__star${value >= n ? ' star-picker__star--filled' : ''}`}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
      {value && (
        <button
          type="button"
          className="star-picker__clear"
          onClick={() => onChange(null)}
          aria-label="Clear rating"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Testimonial form (shared by Add + Edit) ────────────────────────────────────

function TestimonialForm({ initial, onSave, onCancel, submitLabel }) {
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
      await onSave({
        ...form,
        rating: form.rating === '' ? null : Number(form.rating),
        displayOrder: Number(form.displayOrder) || 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="testimonial-form">
      <label className="owner-label">
        Client name *
        <input
          className="owner-input"
          required
          maxLength={100}
          value={form.authorName}
          onChange={set('authorName')}
          placeholder="e.g. Jamie T."
        />
      </label>

      <label className="owner-label">
        Testimonial *
        <textarea
          className="owner-textarea"
          rows={4}
          required
          value={form.body}
          onChange={set('body')}
          placeholder="What did the client say?"
        />
      </label>

      <div className="owner-label">
        Rating
        <StarPicker
          value={form.rating === '' ? null : Number(form.rating)}
          onChange={v => setForm(f => ({ ...f, rating: v ?? '' }))}
        />
      </div>

      <div className="testimonial-form__row">
        <label className="owner-label">
          Display order
          <input
            className="owner-input owner-input--sm"
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={set('displayOrder')}
          />
        </label>

        <label className="owner-toggle">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))}
          />
          <span className="owner-toggle__label">Published</span>
        </label>
      </div>

      {error && <p className="owner-form-error">{error}</p>}

      <div className="testimonial-form__actions">
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

// ── Testimonial row ───────────────────────────────────────────────────────────

function TestimonialRow({ testimonial, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm('Delete this testimonial? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await adminService.deleteTestimonial(testimonial.id);
      onDelete(testimonial.id);
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  const stars = testimonial.rating
    ? '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating)
    : '—';

  return (
    <tr className={!testimonial.is_published ? 'owner-row--inactive' : ''}>
      <td className="testimonial-table__order">{testimonial.display_order}</td>
      <td className="testimonial-table__author">{testimonial.author_name}</td>
      <td className="testimonial-table__body">
        <span className="testimonial-table__excerpt">
          {testimonial.body.length > 120 ? testimonial.body.slice(0, 120) + '…' : testimonial.body}
        </span>
      </td>
      <td className="testimonial-table__rating" aria-label={testimonial.rating ? `${testimonial.rating} out of 5` : 'No rating'}>
        {stars}
      </td>
      <td>
        <span className={`owner-badge ${testimonial.is_published ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {testimonial.is_published ? 'Published' : 'Hidden'}
        </span>
      </td>
      <td className="owner-table__actions">
        <button className="btn btn--outline btn--sm" onClick={() => onEdit(testimonial)}>
          Edit
        </button>
        <button
          className="btn btn--danger btn--sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TestimonialsManagementPage() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    adminService.listTestimonials()
      .then(res => setTestimonials(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(data) {
    const res = await adminService.createTestimonial(data);
    setTestimonials(prev => [...prev, res.data].sort((a, b) => a.display_order - b.display_order || a.created_at?.localeCompare(b.created_at)));
    setShowAdd(false);
  }

  async function handleSave(data) {
    const res = await adminService.updateTestimonial(editing.id, data);
    setTestimonials(prev =>
      prev.map(t => t.id === editing.id ? res.data : t)
        .sort((a, b) => a.display_order - b.display_order)
    );
    setEditing(null);
  }

  function handleDelete(id) {
    setTestimonials(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div className="page owner-loading">Loading…</div>;
  if (error) return <div className="page owner-error">Error: {error}</div>;

  const published = testimonials.filter(t => t.is_published).length;

  return (
    <div className="page owner-page">
      <h1 className="owner-page__title">Testimonials</h1>

      <section className="owner-section">
        <div className="owner-section__header">
          <div>
            <p className="owner-section__meta">
              {testimonials.length} total · {published} published
            </p>
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => { setShowAdd(s => !s); setEditing(null); }}
          >
            {showAdd ? 'Cancel' : 'Add Testimonial'}
          </button>
        </div>

        {showAdd && (
          <div className="owner-edit-panel">
            <h3 className="owner-edit-panel__title">Add Testimonial</h3>
            <TestimonialForm
              initial={EMPTY_FORM}
              onSave={handleAdd}
              onCancel={() => setShowAdd(false)}
              submitLabel="Add Testimonial"
            />
          </div>
        )}

        {editing && (
          <div className="owner-edit-panel">
            <h3 className="owner-edit-panel__title">Edit Testimonial</h3>
            <TestimonialForm
              initial={{
                authorName: editing.author_name,
                body: editing.body,
                rating: editing.rating ?? '',
                isPublished: editing.is_published,
                displayOrder: editing.display_order,
              }}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              submitLabel="Save Changes"
            />
          </div>
        )}

        {testimonials.length === 0 ? (
          <p className="owner-empty">No testimonials yet. Add one above.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Client</th>
                  <th>Testimonial</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {testimonials.map(t => (
                  <TestimonialRow
                    key={t.id}
                    testimonial={t}
                    onEdit={t => { setEditing(t); setShowAdd(false); }}
                    onDelete={handleDelete}
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
