import { useEffect, useState } from 'react';
import { adminService } from '../../services/adminService.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Business Hours ────────────────────────────────────────────────────────────

function HoursRow({ entry, onSave }) {
  const [form, setForm] = useState({
    openTime: entry.open_time?.slice(0, 5) ?? '09:00',
    closeTime: entry.close_time?.slice(0, 5) ?? '17:00',
    isClosed: entry.is_closed ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave(entry.day_of_week, form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className={`hours-row${form.isClosed ? ' hours-row--closed' : ''}`}>
      <td className="hours-row__day">{DAYS[entry.day_of_week]}</td>
      <td>
        <input
          type="time"
          className="owner-input"
          value={form.openTime}
          disabled={form.isClosed}
          onChange={e => setForm(f => ({ ...f, openTime: e.target.value }))}
        />
      </td>
      <td>
        <input
          type="time"
          className="owner-input"
          value={form.closeTime}
          disabled={form.isClosed}
          onChange={e => setForm(f => ({ ...f, closeTime: e.target.value }))}
        />
      </td>
      <td>
        <label className="owner-toggle">
          <input
            type="checkbox"
            checked={form.isClosed}
            onChange={e => setForm(f => ({ ...f, isClosed: e.target.checked }))}
          />
          <span className="owner-toggle__label">Closed</span>
        </label>
      </td>
      <td>
        <button className="btn btn--outline btn--sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {error && <span className="owner-inline-error">{error}</span>}
      </td>
    </tr>
  );
}

function BusinessHoursSection({ hours, onUpdate }) {
  async function handleSave(dayOfWeek, form) {
    const res = await adminService.updateBusinessHours(dayOfWeek, {
      openTime: form.openTime,
      closeTime: form.closeTime,
      isClosed: form.isClosed,
    });
    onUpdate(res.data);
  }

  const fullWeek = DAYS.map((_, i) => {
    const found = hours.find(h => h.day_of_week === i);
    return found ?? { day_of_week: i, open_time: '09:00', close_time: '17:00', is_closed: false };
  });

  return (
    <section className="owner-section">
      <h2 className="owner-section__title">Operating Hours</h2>
      <div className="owner-table-wrapper">
        <table className="owner-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Opens</th>
              <th>Closes</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fullWeek.map(entry => (
              <HoursRow key={entry.day_of_week} entry={entry} onSave={handleSave} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Massage Tables ────────────────────────────────────────────────────────────

function MassageBedRow({ bed, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: bed.name, isActive: bed.is_active });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await adminService.updateMassageBed(bed.id, form);
      onUpdate(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove "${bed.name}"? This cannot be undone.`)) return;
    setSaving(true);
    setError('');
    try {
      await adminService.deleteMassageBed(bed.id);
      onDelete(bed.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td>
          <input
            className="owner-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </td>
        <td>
          <label className="owner-toggle">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
            />
            <span className="owner-toggle__label">Active</span>
          </label>
        </td>
        <td className="owner-table__actions">
          <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
          {error && <span className="owner-inline-error">{error}</span>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{bed.name}</td>
      <td>
        <span className={`owner-badge ${bed.is_active ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {bed.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="owner-table__actions">
        <button className="btn btn--outline btn--sm" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn btn--danger btn--sm" onClick={handleDelete}>Remove</button>
        {error && <span className="owner-inline-error">{error}</span>}
      </td>
    </tr>
  );
}

function MassageBedsSection({ beds, onBedsChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const activeBeds = beds.filter(b => b.is_active).length;

  async function handleAdd() {
    if (!addName.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await adminService.createMassageBed({ name: addName.trim() });
      onBedsChange([...beds, res.data]);
      setAddName('');
      setShowAdd(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function handleUpdate(updated) {
    onBedsChange(beds.map(b => b.id === updated.id ? updated : b));
  }

  function handleDelete(id) {
    onBedsChange(beds.filter(b => b.id !== id));
  }

  return (
    <section className="owner-section">
      <div className="owner-section__header">
        <div>
          <h2 className="owner-section__title">Massage Tables</h2>
          <p className="owner-section__meta">{activeBeds} active of {beds.length} total</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : 'Add Table'}
        </button>
      </div>

      {showAdd && (
        <div className="owner-add-row">
          <input
            className="owner-input"
            placeholder="Table name (e.g. Table 4)"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button className="btn btn--primary btn--sm" onClick={handleAdd} disabled={adding || !addName.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </button>
          {addError && <span className="owner-inline-error">{addError}</span>}
        </div>
      )}

      {beds.length === 0 ? (
        <p className="owner-empty">No massage tables yet. Add one above.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {beds.map(bed => (
                <MassageBedRow
                  key={bed.id}
                  bed={bed}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Services ──────────────────────────────────────────────────────────────────

const EMPTY_SERVICE = { name: '', description: '', durationMinutes: 60, priceCents: 0, isActive: true };

function ServiceRow({ service, onUpdate, onDeactivate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: service.name,
    description: service.description ?? '',
    durationMinutes: service.duration_minutes,
    priceCents: service.price_cents,
    isActive: service.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await adminService.updateService(service.id, {
        ...form,
        priceCents: Number(form.priceCents),
        durationMinutes: Number(form.durationMinutes),
      });
      onUpdate(res.data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!window.confirm(`Deactivate "${service.name}"?`)) return;
    setSaving(true);
    setError('');
    try {
      await adminService.deactivateService(service.id);
      onDeactivate(service.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td>
          <input
            className="owner-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <input
            className="owner-input owner-input--secondary"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </td>
        <td>
          <input
            type="number"
            className="owner-input owner-input--narrow"
            min="1"
            value={form.durationMinutes}
            onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
          />
          <span className="owner-unit">min</span>
        </td>
        <td>
          <span className="owner-currency">$</span>
          <input
            type="number"
            className="owner-input owner-input--narrow"
            min="0"
            step="100"
            value={form.priceCents}
            onChange={e => setForm(f => ({ ...f, priceCents: e.target.value }))}
          />
          <span className="owner-unit">¢</span>
        </td>
        <td>
          <label className="owner-toggle">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
            />
            <span className="owner-toggle__label">Active</span>
          </label>
        </td>
        <td className="owner-table__actions">
          <button className="btn btn--primary btn--sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
          {error && <span className="owner-inline-error">{error}</span>}
        </td>
      </tr>
    );
  }

  return (
    <tr className={!service.is_active ? 'owner-row--inactive' : ''}>
      <td>
        <span className="owner-service-name">{service.name}</span>
        {service.description && (
          <span className="owner-service-desc">{service.description}</span>
        )}
      </td>
      <td>{service.duration_minutes} min</td>
      <td>{formatCents(service.price_cents)}</td>
      <td>
        <span className={`owner-badge ${service.is_active ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {service.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="owner-table__actions">
        <button className="btn btn--outline btn--sm" onClick={() => setEditing(true)}>Edit</button>
        {service.is_active && (
          <button className="btn btn--danger btn--sm" onClick={handleDeactivate} disabled={saving}>
            Deactivate
          </button>
        )}
        {error && <span className="owner-inline-error">{error}</span>}
      </td>
    </tr>
  );
}

function ServicesSection({ services, onServicesChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  async function handleAdd() {
    if (!form.name.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await adminService.createService({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        durationMinutes: Number(form.durationMinutes),
        priceCents: Number(form.priceCents),
      });
      onServicesChange([...services, res.data]);
      setForm(EMPTY_SERVICE);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function handleUpdate(updated) {
    onServicesChange(services.map(s => s.id === updated.id ? updated : s));
  }

  function handleDeactivate(id) {
    onServicesChange(services.map(s => s.id === id ? { ...s, is_active: false } : s));
  }

  return (
    <section className="owner-section">
      <div className="owner-section__header">
        <div>
          <h2 className="owner-section__title">Services</h2>
          <p className="owner-section__meta">{services.filter(s => s.is_active).length} active</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showAdd && (
        <div className="owner-add-panel">
          <h3 className="owner-add-panel__title">New Service</h3>
          <div className="owner-add-panel__fields">
            <label className="owner-label">
              Name
              <input
                className="owner-input"
                placeholder="e.g. Swedish Massage"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </label>
            <label className="owner-label">
              Description
              <input
                className="owner-input"
                placeholder="Optional"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="owner-label">
              Duration (min)
              <input
                type="number"
                className="owner-input owner-input--narrow"
                min="1"
                value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
              />
            </label>
            <label className="owner-label">
              Price (cents)
              <input
                type="number"
                className="owner-input owner-input--narrow"
                min="0"
                step="100"
                placeholder="e.g. 9000 = $90.00"
                value={form.priceCents}
                onChange={e => setForm(f => ({ ...f, priceCents: e.target.value }))}
              />
            </label>
          </div>
          <div className="owner-add-panel__footer">
            <button
              className="btn btn--primary btn--sm"
              onClick={handleAdd}
              disabled={adding || !form.name.trim()}
            >
              {adding ? 'Adding…' : 'Add Service'}
            </button>
            {addError && <span className="owner-inline-error">{addError}</span>}
          </div>
        </div>
      )}

      {services.length === 0 ? (
        <p className="owner-empty">No services yet. Add one above.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.map(svc => (
                <ServiceRow
                  key={svc.id}
                  service={svc}
                  onUpdate={handleUpdate}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BusinessDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hours, setHours] = useState([]);
  const [beds, setBeds] = useState([]);
  const [services, setServices] = useState([]);

  useEffect(() => {
    adminService.getBusinessDetails()
      .then(res => {
        setHours(res.data.hours);
        setBeds(res.data.beds);
        setServices(res.data.services);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleHoursUpdate(updated) {
    setHours(prev => {
      const exists = prev.some(h => h.day_of_week === updated.day_of_week);
      return exists
        ? prev.map(h => h.day_of_week === updated.day_of_week ? updated : h)
        : [...prev, updated];
    });
  }

  if (loading) return <div className="page owner-loading">Loading…</div>;
  if (error) return <div className="page owner-error">Error: {error}</div>;

  return (
    <div className="page owner-page">
      <h1 className="owner-page__title">Business Details</h1>

      <BusinessHoursSection hours={hours} onUpdate={handleHoursUpdate} />
      <MassageBedsSection beds={beds} onBedsChange={setBeds} />
      <ServicesSection services={services} onServicesChange={setServices} />
    </div>
  );
}
