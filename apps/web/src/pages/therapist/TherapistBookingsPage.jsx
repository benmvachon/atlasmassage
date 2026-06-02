import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api.js';

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show:   'No Show',
};

const STATUS_FILTER_OPTIONS = [
  { value: '',                   label: 'All Appointments' },
  { value: 'future',             label: 'Upcoming' },
  { value: 'past',               label: 'Past' },
  { value: 'cancelled',          label: 'Cancelled' },
  { value: 'transfer_requested', label: 'Transfer Requested' },
];

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function TransferModal({ appt, onClose, onSubmit, saving, error }) {
  const [reason, setReason] = useState('');

  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <h3 className="cal-detail__title">Request Transfer</h3>
          <button className="cal-detail__close" onClick={onClose}>&#x2715;</button>
        </div>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.875rem', marginBottom: '1rem', color: '#374151' }}>
          Requesting transfer for <strong>{appt.client_name}</strong> &mdash; {appt.service_name}<br />
          <span style={{ color: '#6b7280' }}>{formatDateTime(appt.scheduled_at)}</span>
        </p>
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="owner-label">
            Reason (optional)
            <textarea
              className="owner-textarea"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="E.g., schedule conflict, personal leave…"
            />
          </label>
        </div>
        {error && <p className="owner-form-error" style={{ marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => onSubmit(reason)}
            disabled={saving}
          >
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


function generateMonthOptions() {
  const options = [{ value: '', label: 'All Time' }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  // Add 2 future months
  for (let i = 1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.splice(1, 0, { value, label });
  }
  return options;
}

const MONTH_OPTIONS = generateMonthOptions();

export default function TherapistBookingsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [month, setMonth] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientInput, setClientInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortDir, setSortDir] = useState('desc');

  const [transferAppt, setTransferAppt] = useState(null);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (clientSearch) params.set('client', clientSearch);
    if (statusFilter) params.set('status', statusFilter);
    api.get(`/appointments?${params}`)
      .then(r => setAppointments(r.data))
      .catch(() => setError('Failed to load appointments.'))
      .finally(() => setLoading(false));
  }, [month, clientSearch, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function handleClientSearch(e) {
    e.preventDefault();
    setClientSearch(clientInput);
  }

  function clearClientSearch() {
    setClientInput('');
    setClientSearch('');
  }

  const sorted = [...appointments].sort((a, b) => {
    const ta = new Date(a.scheduled_at).getTime();
    const tb = new Date(b.scheduled_at).getTime();
    return sortDir === 'asc' ? ta - tb : tb - ta;
  });

  async function handleTransferSubmit(reason) {
    if (!transferAppt) return;
    setTransferSaving(true);
    setTransferError(null);
    try {
      await api.post(`/appointments/${transferAppt.id}/transfer-request`, { reason });
      setTransferAppt(null);
      load();
    } catch (err) {
      setTransferError(err.message || 'Failed to submit transfer request.');
    } finally {
      setTransferSaving(false);
    }
  }

  const canRequestTransfer = appt =>
    ['pending', 'confirmed'].includes(appt.status) &&
    new Date(appt.scheduled_at) > new Date() &&
    !appt.transfer_request_id;

  return (
    <div className="page owner-page owner-page--wide">
      <h1 className="owner-page__title">My Bookings</h1>

      {/* Filters */}
      <div className="bookings-filters">
        <select
          className="owner-input bookings-filters__select"
          value={month}
          onChange={e => setMonth(e.target.value)}
        >
          {MONTH_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="owner-input bookings-filters__select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <form onSubmit={handleClientSearch} className="bookings-filters__search">
          <input
            type="text"
            className="owner-input"
            placeholder="Search client name or email…"
            value={clientInput}
            onChange={e => setClientInput(e.target.value)}
          />
          <button type="submit" className="btn btn--outline btn--sm">Search</button>
          {clientSearch && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearClientSearch}>
              Clear
            </button>
          )}
        </form>

        <button
          className="btn btn--ghost btn--sm bookings-filters__sort"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          title={`Sort by date ${sortDir === 'asc' ? 'newest first' : 'oldest first'}`}
        >
          Date {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {loading && <p className="owner-loading">Loading bookings…</p>}
      {error && <p className="owner-error">{error}</p>}

      {!loading && !error && (
        <>
          {sorted.length === 0 ? (
            <p className="owner-empty">No appointments match your filters.</p>
          ) : (
            <div className="owner-section">
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Client</th>
                      <th>Service</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(appt => (
                      <tr key={appt.id} className={appt.status === 'cancelled' ? 'owner-row--inactive' : ''}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(appt.scheduled_at)}</td>
                        <td>
                          <span className="therapist-name">{appt.client_name}</span>
                          {appt.client_email && (
                            <span className="owner-service-desc">{appt.client_email}</span>
                          )}
                        </td>
                        <td>{appt.service_name}</td>
                        <td>{appt.duration_minutes} min</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span className={`cal-status cal-status--${appt.status}`}>
                              {STATUS_LABELS[appt.status]}
                            </span>
                            {appt.transfer_request_id && (
                              <span className="cal-status cal-status--transfer">Transfer Requested</span>
                            )}
                          </div>
                        </td>
                        <td className="owner-table__actions">
                          {canRequestTransfer(appt) && (
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={() => setTransferAppt(appt)}
                            >
                              Request Transfer
                            </button>
                          )}
                          {appt.transfer_request_id && (
                            <span className="bookings-transfer-badge">Transfer pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="bookings-count">{sorted.length} appointment{sorted.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </>
      )}

      {transferAppt && (
        <TransferModal
          appt={transferAppt}
          onClose={() => { setTransferAppt(null); setTransferError(null); }}
          onSubmit={handleTransferSubmit}
          saving={transferSaving}
          error={transferError}
        />
      )}
    </div>
  );
}
