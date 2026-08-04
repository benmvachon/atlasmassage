import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService.js';

// Human labels for the canonical action/entity names written by auditService.js.
// Unknown values fall through to the raw string rather than rendering blank —
// a log viewer that hides entries it does not recognise is worse than useless.
const ACTION_LABELS = {
  'phi.read':   'Viewed',
  'phi.write':  'Edited',
  'phi.create': 'Submitted',
};

const ENTITY_LABELS = {
  client_history: 'Client history',
  soap_notes:     'SOAP notes',
  health_record:  'Intake form',
};

const ACTION_TONE = {
  'phi.read':   { background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
  'phi.write':  { background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' },
  'phi.create': { background: '#dcfce7', color: '#15803d', borderColor: '#86efac' },
};

const ENTITY_OPTIONS = [
  { value: '',               label: 'All records' },
  { value: 'client_history', label: 'Client history' },
  { value: 'soap_notes',     label: 'SOAP notes' },
  { value: 'health_record',  label: 'Intake form' },
];

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function actorLabel(entry) {
  if (entry.first_name || entry.last_name) {
    return `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim();
  }
  // No joined user row: either an unauthenticated action (a guest submitting
  // their own intake) or an account deleted since the entry was written.
  if (!entry.user_id) return 'Client (unauthenticated)';
  return 'Deleted user';
}

export default function AuditLogsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminService.getAuditLogs({ action, entity, start, end, page })
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load audit logs.'))
      .finally(() => setLoading(false));
  }, [action, entity, start, end, page]);

  useEffect(() => { load(); }, [load]);

  // Any filter change invalidates the current page number.
  function updateFilter(setter) {
    return (value) => { setter(value); setPage(1); };
  }

  function clearFilters() {
    setAction('');
    setEntity('');
    setStart('');
    setEnd('');
    setPage(1);
  }

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const hasFilters = Boolean(action || entity || start || end);

  return (
    <div className="page owner-page">
      <div className="owner-page__breadcrumb">
        <Link to="/owner/dashboard">Dashboard</Link> / Audit Log
      </div>
      <h1 className="owner-page__title">Audit Log</h1>
      <p className="owner-page__subtitle">
        Every access to client health information — who, what, and when. Entries are
        append-only and are never removed.
      </p>

      <div className="owner-section">
        <div className="audit-filters">
          <label className="owner-label">
            Action
            <select
              className="owner-input"
              value={action}
              onChange={e => updateFilter(setAction)(e.target.value)}
            >
              <option value="">All actions</option>
              {(data?.actions ?? []).map(a => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </select>
          </label>

          <label className="owner-label">
            Record type
            <select
              className="owner-input"
              value={entity}
              onChange={e => updateFilter(setEntity)(e.target.value)}
            >
              {ENTITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="owner-label">
            From
            <input
              type="date"
              className="owner-input"
              value={start}
              onChange={e => updateFilter(setStart)(e.target.value)}
            />
          </label>

          <label className="owner-label">
            To
            <input
              type="date"
              className="owner-input"
              value={end}
              onChange={e => updateFilter(setEnd)(e.target.value)}
            />
          </label>

          {hasFilters && (
            <button className="btn btn--ghost btn--sm audit-filters__clear" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && <p className="owner-loading">Loading…</p>}
      {error && <p className="owner-error">{error}</p>}

      {!loading && !error && (
        <div className="owner-section">
          <div className="owner-section__header">
            <div>
              <h2 className="owner-section__title">Access History</h2>
              <p className="owner-section__meta">
                {total === 0
                  ? 'No entries'
                  : `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}`}
                {totalPages > 1 && ` · page ${page} of ${totalPages}`}
              </p>
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="owner-empty">
              {hasFilters
                ? 'No entries match these filters.'
                : 'No access to client health information has been recorded yet.'}
            </p>
          ) : (
            <div className="owner-table-wrapper">
              <table className="owner-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Appointment</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                        {formatTimestamp(e.created_at)}
                      </td>
                      <td>
                        <span style={{ display: 'block' }}>{actorLabel(e)}</span>
                        {e.actor_email && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{e.actor_email}</span>
                        )}
                      </td>
                      <td>
                        <span
                          className="owner-badge"
                          style={ACTION_TONE[e.action] ?? {}}
                        >
                          {ACTION_LABELS[e.action] ?? e.action}
                        </span>
                      </td>
                      <td>{ENTITY_LABELS[e.entity] ?? e.entity}</td>
                      <td style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                        {e.entity_id ? e.entity_id.slice(0, 8) : '—'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                        {e.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="audit-pagination">
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page <= 1}
              >
                ← Previous
              </button>
              <span className="audit-pagination__status">Page {page} of {totalPages}</span>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
