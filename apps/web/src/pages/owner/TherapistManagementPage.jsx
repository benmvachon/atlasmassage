import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminService } from '../../services/adminService.js';

const EMPTY_THERAPIST = {
  firstName: '', lastName: '', email: '', password: '',
  phone: '', bio: '', specialties: '', isAcceptingClients: true,
};

// ── Specialty tag input ───────────────────────────────────────────────────────

function SpecialtyInput({ value, onChange }) {
  const [input, setInput] = useState('');
  const tags = value.filter(Boolean);

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
  }

  function removeTag(tag) {
    onChange(tags.filter(t => t !== tag));
  }

  return (
    <div className="specialty-input">
      <div className="specialty-input__tags">
        {tags.map(tag => (
          <span key={tag} className="specialty-tag">
            {tag}
            <button
              type="button"
              className="specialty-tag__remove"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="specialty-input__row">
        <input
          className="owner-input"
          placeholder="Add specialty (e.g. deep tissue)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        />
        <button type="button" className="btn btn--outline btn--sm" onClick={addTag}>
          Add
        </button>
      </div>
    </div>
  );
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function EditPanel({ therapist, onSave, onCancel }) {
  const [form, setForm] = useState({
    bio: therapist.bio ?? '',
    specialties: therapist.specialties ?? [],
    isAcceptingClients: therapist.is_accepting_clients,
    displayOrder: therapist.display_order ?? 0,
  });
  const [headshotFile, setHeadshotFile] = useState(null);
  const [headshotPreview, setHeadshotPreview] = useState(therapist.headshot_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setHeadshotFile(file);
    setHeadshotPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const [profileRes] = await Promise.all([
        adminService.updateTherapist(therapist.id, { ...form, displayOrder: Number(form.displayOrder) || 0 }),
        headshotFile ? adminService.uploadTherapistHeadshot(therapist.id, headshotFile) : Promise.resolve(null),
      ]);
      const updated = headshotFile
        ? await adminService.listTherapists().then(r => r.data.find(t => t.id === therapist.id))
        : profileRes.data;
      onSave(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="owner-edit-panel">
      <h3 className="owner-edit-panel__title">
        Edit {therapist.first_name} {therapist.last_name}
      </h3>
      <form onSubmit={handleSubmit} className="owner-edit-panel__form">
        <div className="owner-headshot-upload">
          <div className="owner-headshot-upload__preview">
            {headshotPreview
              ? <img src={headshotPreview} alt="Headshot preview" />
              : <span className="owner-headshot-upload__placeholder">No photo</span>}
          </div>
          <label className="owner-label owner-headshot-upload__label">
            Headshot photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="owner-headshot-upload__input"
            />
            <span className="btn btn--outline btn--sm owner-headshot-upload__btn">
              Choose photo
            </span>
          </label>
        </div>

        <label className="owner-label">
          Bio
          <textarea
            className="owner-textarea"
            rows={3}
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="Brief therapist biography"
          />
        </label>

        <div className="owner-label">
          Specialties
          <SpecialtyInput
            value={form.specialties}
            onChange={specialties => setForm(f => ({ ...f, specialties }))}
          />
        </div>

        <label className="owner-label">
          Display order
          <input
            className="owner-input owner-input--sm"
            type="number"
            min={0}
            value={form.displayOrder}
            onChange={e => setForm(f => ({ ...f, displayOrder: e.target.value }))}
          />
        </label>

        <label className="owner-toggle">
          <input
            type="checkbox"
            checked={form.isAcceptingClients}
            onChange={e => setForm(f => ({ ...f, isAcceptingClients: e.target.checked }))}
          />
          <span className="owner-toggle__label">Accepting new clients</span>
        </label>

        {error && <p className="owner-form-error">{error}</p>}

        <div className="owner-edit-panel__actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Add therapist form ────────────────────────────────────────────────────────

function AddTherapistForm({ onAdd, onCancel }) {
  const [form, setForm] = useState(EMPTY_THERAPIST);
  const [specialties, setSpecialties] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setAdding(true);
    setError('');
    try {
      const res = await adminService.createTherapist({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        bio: form.bio || undefined,
        specialties,
        isAcceptingClients: form.isAcceptingClients,
      });
      onAdd(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  return (
    <div className="owner-add-panel">
      <h3 className="owner-add-panel__title">Add Therapist</h3>
      <form onSubmit={handleSubmit} className="owner-add-panel__form">
        <div className="owner-add-panel__fields owner-add-panel__fields--two-col">
          <label className="owner-label">
            First Name *
            <input className="owner-input" required value={form.firstName} onChange={set('firstName')} />
          </label>
          <label className="owner-label">
            Last Name *
            <input className="owner-input" required value={form.lastName} onChange={set('lastName')} />
          </label>
          <label className="owner-label">
            Email *
            <input className="owner-input" type="email" required value={form.email} onChange={set('email')} />
          </label>
          <label className="owner-label">
            Temporary Password *
            <input className="owner-input" type="password" required minLength={8} value={form.password} onChange={set('password')} />
          </label>
          <label className="owner-label">
            Phone
            <input className="owner-input" type="tel" value={form.phone} onChange={set('phone')} />
          </label>
        </div>

        <label className="owner-label">
          Bio
          <textarea
            className="owner-textarea"
            rows={3}
            value={form.bio}
            onChange={set('bio')}
            placeholder="Brief therapist biography"
          />
        </label>

        <div className="owner-label">
          Specialties
          <SpecialtyInput value={specialties} onChange={setSpecialties} />
        </div>

        <label className="owner-toggle">
          <input
            type="checkbox"
            checked={form.isAcceptingClients}
            onChange={e => setForm(f => ({ ...f, isAcceptingClients: e.target.checked }))}
          />
          <span className="owner-toggle__label">Accepting new clients</span>
        </label>

        {error && <p className="owner-form-error">{error}</p>}

        <div className="owner-add-panel__footer">
          <button type="submit" className="btn btn--primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add Therapist'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Therapist row ─────────────────────────────────────────────────────────────

function TherapistRow({ therapist, currentUserId, onEdit, onDeactivate }) {
  const [removing, setRemoving] = useState(false);
  const isSelf = therapist.id === currentUserId;

  async function handleDeactivate() {
    if (!window.confirm(`Deactivate ${therapist.first_name} ${therapist.last_name}? They will no longer be able to log in.`)) return;
    setRemoving(true);
    try {
      await adminService.deactivateTherapist(therapist.id);
      onDeactivate(therapist.id);
    } catch (err) {
      alert(err.message);
      setRemoving(false);
    }
  }

  return (
    <tr className={!therapist.is_active ? 'owner-row--inactive' : ''}>
      <td className="owner-table__order">{therapist.display_order}</td>
      <td>
        <span className="therapist-name">
          {therapist.headshot_url && (
            <img
              src={therapist.headshot_url}
              alt=""
              className="therapist-name__thumb"
            />
          )}
          {therapist.first_name} {therapist.last_name}
          {isSelf && <span className="owner-badge owner-badge--self">You</span>}
        </span>
      </td>
      <td>{therapist.email}</td>
      <td>
        {therapist.specialties?.length
          ? therapist.specialties.map(s => (
              <span key={s} className="specialty-tag specialty-tag--sm">{s}</span>
            ))
          : <span className="owner-muted">—</span>}
      </td>
      <td>
        <span className={`owner-badge ${therapist.is_accepting_clients ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {therapist.is_accepting_clients ? 'Accepting' : 'Not accepting'}
        </span>
      </td>
      <td>
        <span className={`owner-badge ${therapist.is_active ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {therapist.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="owner-table__actions">
        {therapist.is_active && (
          <>
            <button className="btn btn--outline btn--sm" onClick={() => onEdit(therapist)}>
              Edit
            </button>
            {!isSelf && (
              <button className="btn btn--danger btn--sm" onClick={handleDeactivate} disabled={removing}>
                Deactivate
              </button>
            )}
          </>
        )}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TherapistManagementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [therapists, setTherapists] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTherapist, setEditingTherapist] = useState(null);

  useEffect(() => {
    adminService.listTherapists()
      .then(res => setTherapists(res.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleAdded(therapist) {
    setTherapists(prev => [...prev, therapist]);
    setShowAdd(false);
  }

  function handleSaved(updated) {
    setTherapists(prev =>
      prev.map(t => t.id === updated.id ? updated : t)
        .sort((a, b) => a.display_order - b.display_order
          || a.last_name.localeCompare(b.last_name)
          || a.first_name.localeCompare(b.first_name))
    );
    setEditingTherapist(null);
  }

  function handleDeactivated(id) {
    setTherapists(prev => prev.map(t => t.id === id ? { ...t, is_active: false } : t));
  }

  if (loading) return <div className="page owner-loading">Loading…</div>;
  if (error) return <div className="page owner-error">Error: {error}</div>;

  const active = therapists.filter(t => t.is_active).length;

  return (
    <div className="page owner-page">
      <h1 className="owner-page__title">Therapist Management</h1>

      <section className="owner-section">
        <div className="owner-section__header">
          <div>
            <p className="owner-section__meta">{active} active therapist{active !== 1 ? 's' : ''}</p>
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => { setShowAdd(s => !s); setEditingTherapist(null); }}
          >
            {showAdd ? 'Cancel' : 'Add Therapist'}
          </button>
        </div>

        {showAdd && (
          <AddTherapistForm onAdd={handleAdded} onCancel={() => setShowAdd(false)} />
        )}

        {editingTherapist && (
          <EditPanel
            therapist={editingTherapist}
            onSave={handleSaved}
            onCancel={() => setEditingTherapist(null)}
          />
        )}

        {therapists.length === 0 ? (
          <p className="owner-empty">No therapists yet. Add one above.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Specialties</th>
                  <th>Availability</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {therapists.map(therapist => (
                  <TherapistRow
                    key={therapist.id}
                    therapist={therapist}
                    currentUserId={user?.id}
                    onEdit={t => { setEditingTherapist(t); setShowAdd(false); }}
                    onDeactivate={handleDeactivated}
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
