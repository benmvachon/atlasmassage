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

function dollarsFromCents(cents) {
  return (cents / 100).toFixed(2);
}

function centsDollars(dollars) {
  return Math.round(parseFloat(dollars || '0') * 100);
}

const EMPTY_SERVICE = { name: '', description: '', durationMinutes: 60, priceDollars: '0.00', isActive: true };

function ServiceRow({ service, onUpdate, onDeactivate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: service.name,
    description: service.description ?? '',
    durationMinutes: service.duration_minutes,
    priceDollars: dollarsFromCents(service.price_cents),
    isActive: service.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await adminService.updateService(service.id, {
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        priceCents: centsDollars(form.priceDollars),
        isActive: form.isActive,
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
            step="0.01"
            value={form.priceDollars}
            onChange={e => setForm(f => ({ ...f, priceDollars: e.target.value }))}
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
        priceCents: centsDollars(form.priceDollars),
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
              Price
              <div className="owner-input-prefix">
                <span className="owner-currency">$</span>
                <input
                  type="number"
                  className="owner-input owner-input--narrow"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.priceDollars}
                  onChange={e => setForm(f => ({ ...f, priceDollars: e.target.value }))}
                />
              </div>
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

// ── Membership Plans ──────────────────────────────────────────────────────────

const EMPTY_PLAN = { name: '', description: '', priceDollars: '0.00', creditsPerMonth: 1, isActive: true };

function PlanRow({ plan, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: plan.name,
    description: plan.description ?? '',
    priceDollars: dollarsFromCents(plan.price_monthly_cents),
    creditsPerMonth: plan.credits_per_month,
    isActive: plan.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await adminService.updateMembershipPlan(plan.id, {
        name: form.name,
        description: form.description || undefined,
        priceMonthlyCents: centsDollars(form.priceDollars),
        creditsPerMonth: Number(form.creditsPerMonth),
        isActive: form.isActive,
      });
      onUpdate(res.data.plan);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
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
          <span className="owner-currency">$</span>
          <input
            type="number"
            className="owner-input owner-input--narrow"
            min="0"
            step="0.01"
            value={form.priceDollars}
            onChange={e => setForm(f => ({ ...f, priceDollars: e.target.value }))}
          />
          <span className="owner-unit">/mo</span>
        </td>
        <td>
          <input
            type="number"
            className="owner-input owner-input--narrow"
            min="1"
            value={form.creditsPerMonth}
            onChange={e => setForm(f => ({ ...f, creditsPerMonth: e.target.value }))}
          />
          <span className="owner-unit">credits</span>
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
    <tr className={!plan.is_active ? 'owner-row--inactive' : ''}>
      <td>
        <span className="owner-service-name">{plan.name}</span>
        {plan.description && <span className="owner-service-desc">{plan.description}</span>}
      </td>
      <td>{formatCents(plan.price_monthly_cents)}/mo</td>
      <td>{plan.credits_per_month} credits/mo</td>
      <td>
        <span className={`owner-badge ${plan.is_active ? 'owner-badge--active' : 'owner-badge--inactive'}`}>
          {plan.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="owner-table__actions">
        <button className="btn btn--outline btn--sm" onClick={() => setEditing(true)}>Edit</button>
        {error && <span className="owner-inline-error">{error}</span>}
      </td>
    </tr>
  );
}

function MembershipPlansSection({ plans, onPlansChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  async function handleAdd() {
    if (!form.name.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await adminService.createMembershipPlan({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        priceMonthlyCents: centsDollars(form.priceDollars),
        creditsPerMonth: Number(form.creditsPerMonth),
      });
      onPlansChange([...plans, res.data.plan]);
      setForm(EMPTY_PLAN);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  function handleUpdate(updated) {
    onPlansChange(plans.map(p => p.id === updated.id ? updated : p));
  }

  return (
    <section className="owner-section">
      <div className="owner-section__header">
        <div>
          <h2 className="owner-section__title">Membership Plans</h2>
          <p className="owner-section__meta">{plans.filter(p => p.is_active).length} active</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : 'Add Plan'}
        </button>
      </div>

      {showAdd && (
        <div className="owner-add-panel">
          <h3 className="owner-add-panel__title">New Membership Plan</h3>
          <div className="owner-add-panel__fields">
            <label className="owner-label">
              Name
              <input
                className="owner-input"
                placeholder="e.g. Wellness Monthly"
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
              Monthly Price
              <div className="owner-input-prefix">
                <span className="owner-currency">$</span>
                <input
                  type="number"
                  className="owner-input owner-input--narrow"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.priceDollars}
                  onChange={e => setForm(f => ({ ...f, priceDollars: e.target.value }))}
                />
              </div>
            </label>
            <label className="owner-label">
              Credits/Month
              <input
                type="number"
                className="owner-input owner-input--narrow"
                min="1"
                value={form.creditsPerMonth}
                onChange={e => setForm(f => ({ ...f, creditsPerMonth: e.target.value }))}
              />
            </label>
          </div>
          <div className="owner-add-panel__footer">
            <button
              className="btn btn--primary btn--sm"
              onClick={handleAdd}
              disabled={adding || !form.name.trim()}
            >
              {adding ? 'Adding…' : 'Add Plan'}
            </button>
            {addError && <span className="owner-inline-error">{addError}</span>}
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <p className="owner-empty">No membership plans yet. Add one above.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Credits</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <PlanRow key={plan.id} plan={plan} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Booking Restrictions ──────────────────────────────────────────────────────

function BookingRestrictionsSection({ restrictions, onRestrictionsChange }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    restrict_pregnancy: restrictions?.restrict_pregnancy ?? true,
    restrict_minors: restrictions?.restrict_minors ?? true,
  });

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await adminService.updateBookingRestrictions({
        restrictPregnancy: form.restrict_pregnancy,
        restrictMinors: form.restrict_minors,
      });
      onRestrictionsChange(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="owner-section">
      <h2 className="owner-section__title">Booking Restrictions</h2>
      <p className="owner-section__desc">
        These restrictions prevent clients from booking if they meet the specified criteria.
        Turn them off once your staff has obtained the relevant certification.
      </p>

      <div className="owner-restrictions">
        <label className="owner-restriction-row">
          <input
            type="checkbox"
            checked={form.restrict_pregnancy}
            onChange={e => setForm(f => ({ ...f, restrict_pregnancy: e.target.checked }))}
            disabled={saving}
          />
          <div className="owner-restriction-row__text">
            <span className="owner-restriction-row__label">Restrict pregnant and recently-pregnant clients</span>
            <span className="owner-restriction-row__desc">
              Clients who indicate they are currently pregnant or were pregnant within the last 3 months
              will not be able to complete a booking. Disable once certified for prenatal and postnatal massage.
            </span>
          </div>
        </label>

        <label className="owner-restriction-row">
          <input
            type="checkbox"
            checked={form.restrict_minors}
            onChange={e => setForm(f => ({ ...f, restrict_minors: e.target.checked }))}
            disabled={saving}
          />
          <div className="owner-restriction-row__text">
            <span className="owner-restriction-row__label">Restrict clients under 18</span>
            <span className="owner-restriction-row__desc">
              Clients who enter a date of birth indicating they are under 18 will not be able
              to complete a booking. Disable once certified for pediatric massage.
            </span>
          </div>
        </label>
      </div>

      <div className="owner-restrictions__footer">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="owner-inline-success">Saved.</span>}
        {saveError && <span className="owner-inline-error">{saveError}</span>}
      </div>
    </section>
  );
}

// ── Travel Settings ────────────────────────────────────────────────────────────

function TravelSettingsSection({ settings, onSettingsChange }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    travel_mode_enabled: settings?.travel_mode_enabled ?? true,
  });

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await adminService.updateTravelSettings({
        travelModeEnabled: form.travel_mode_enabled,
      });
      onSettingsChange(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="owner-section">
      <h2 className="owner-section__title">Travel Massage Mode</h2>
      <p className="owner-section__desc">
        While enabled, the landing page shows a service-area map instead of a fixed address, the
        office address is hidden from the Contact section, and bookings are rejected if the
        guest&rsquo;s address is outside our 20-minute peak-traffic drive-time range. Disable once you
        operate from a fixed location clients visit.
      </p>

      <div className="owner-restrictions">
        <label className="owner-restriction-row">
          <input
            type="checkbox"
            checked={form.travel_mode_enabled}
            onChange={e => setForm(f => ({ ...f, travel_mode_enabled: e.target.checked }))}
            disabled={saving}
          />
          <div className="owner-restriction-row__text">
            <span className="owner-restriction-row__label">Enable travel massage mode</span>
          </div>
        </label>
      </div>

      <div className="owner-restrictions__footer">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="owner-inline-success">Saved.</span>}
        {saveError && <span className="owner-inline-error">{saveError}</span>}
      </div>
    </section>
  );
}

function SchedulingSettingsSection({ settings, onSettingsChange }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState(settings?.buffer_minutes ?? 15);

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await adminService.updateSchedulingSettings({ bufferMinutes: Number(bufferMinutes) });
      onSettingsChange(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="owner-section">
      <h2 className="owner-section__title">Scheduling</h2>
      <p className="owner-section__desc">
        The minimum gap required between appointments for the same therapist or the same massage table.
      </p>

      <label className="owner-label">
        Buffer time (minutes)
        <input
          className="owner-input owner-input--narrow"
          type="number"
          min={0}
          max={120}
          step={5}
          value={bufferMinutes}
          onChange={e => setBufferMinutes(e.target.value)}
          disabled={saving}
        />
      </label>

      <div className="owner-restrictions__footer">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="owner-inline-success">Saved.</span>}
        {saveError && <span className="owner-inline-error">{saveError}</span>}
      </div>
    </section>
  );
}

function ContactInfoSection({ contactInfo, onContactInfoChange }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    addressLine1: contactInfo?.address_line1 ?? '',
    addressLine2: contactInfo?.address_line2 ?? '',
    city: contactInfo?.city ?? '',
    state: contactInfo?.state ?? '',
    zip: contactInfo?.zip ?? '',
    phone: contactInfo?.phone ?? '',
    email: contactInfo?.email ?? '',
  });

  function setField(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      const res = await adminService.updateBusinessContactInfo(form);
      onContactInfoChange(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="owner-section">
      <h2 className="owner-section__title">Contact Info</h2>
      <p className="owner-section__desc">
        The address, phone number, and email shown in the Contact section of the public website.
      </p>

      <div className="owner-add-panel__fields owner-add-panel__fields--two-col">
        <label className="owner-label">
          Street address
          <input
            className="owner-input"
            value={form.addressLine1}
            onChange={e => setField('addressLine1', e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="owner-label">
          Apt, suite, etc. <span className="booking-field__optional">(optional)</span>
          <input
            className="owner-input"
            value={form.addressLine2}
            onChange={e => setField('addressLine2', e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="owner-label">
          City
          <input
            className="owner-input"
            value={form.city}
            onChange={e => setField('city', e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="owner-label">
          State
          <input
            className="owner-input owner-input--narrow"
            value={form.state}
            onChange={e => setField('state', e.target.value)}
            maxLength={2}
            placeholder="MA"
            disabled={saving}
          />
        </label>
        <label className="owner-label">
          ZIP code
          <input
            className="owner-input owner-input--narrow"
            value={form.zip}
            onChange={e => setField('zip', e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="owner-label">
          Phone
          <input
            className="owner-input"
            type="tel"
            value={form.phone}
            onChange={e => setField('phone', e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="owner-label">
          Email
          <input
            className="owner-input"
            type="email"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
            disabled={saving}
          />
        </label>
      </div>

      <div className="owner-restrictions__footer">
        <button
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="owner-inline-success">Saved.</span>}
        {saveError && <span className="owner-inline-error">{saveError}</span>}
      </div>
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
  const [plans, setPlans] = useState([]);
  const [restrictions, setRestrictions] = useState(null);
  const [schedulingSettings, setSchedulingSettings] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [travelSettings, setTravelSettings] = useState(null);

  useEffect(() => {
    Promise.all([
      adminService.getBusinessDetails(),
      adminService.listMembershipPlans(),
      adminService.getBookingRestrictions(),
      adminService.getSchedulingSettings(),
      adminService.getBusinessContactInfo(),
      adminService.getTravelSettings(),
    ]).then(([biz, mem, rest, scheduling, contact, travel]) => {
      setHours(biz.data.hours);
      setBeds(biz.data.beds);
      setServices(biz.data.services);
      setPlans(mem.data.plans);
      setRestrictions(rest.data);
      setSchedulingSettings(scheduling.data);
      setContactInfo(contact.data);
      setTravelSettings(travel.data);
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
      <MembershipPlansSection plans={plans} onPlansChange={setPlans} />
      <BookingRestrictionsSection restrictions={restrictions} onRestrictionsChange={setRestrictions} />
      <TravelSettingsSection settings={travelSettings} onSettingsChange={setTravelSettings} />
      <SchedulingSettingsSection settings={schedulingSettings} onSettingsChange={setSchedulingSettings} />
      <ContactInfoSection contactInfo={contactInfo} onContactInfoChange={setContactInfo} />
    </div>
  );
}
