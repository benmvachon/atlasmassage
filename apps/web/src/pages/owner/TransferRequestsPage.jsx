import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService.js';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function ApproveModal({ request, therapists, onClose, onApprove, saving, error }) {
  const [toTherapistId, setToTherapistId] = useState('');

  const eligible = therapists.filter(t => t.id !== request.from_therapist_id && t.is_active);

  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <h3 className="cal-detail__title">Approve Transfer</h3>
          <button className="cal-detail__close" onClick={onClose}>&#x2715;</button>
        </div>

        <dl className="cal-detail__grid" style={{ marginBottom: '1.5rem' }}>
          <dt>Client</dt>
          <dd>{request.client_name}</dd>
          <dt>Service</dt>
          <dd>{request.service_name}</dd>
          <dt>Appointment</dt>
          <dd>{formatDateTime(request.scheduled_at)}</dd>
          <dt>From therapist</dt>
          <dd>{request.from_first_name} {request.from_last_name}</dd>
          {request.reason && <><dt>Reason</dt><dd>{request.reason}</dd></>}
        </dl>

        <div style={{ marginBottom: '1.5rem' }}>
          <label className="owner-label">
            Assign to therapist
            <select
              className="owner-input"
              value={toTherapistId}
              onChange={e => setToTherapistId(e.target.value)}
            >
              <option value="">— Select therapist —</option>
              {eligible.map(t => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="owner-form-error" style={{ marginBottom: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => toTherapistId && onApprove(request.id, toTherapistId)}
            disabled={saving || !toTherapistId}
          >
            {saving ? 'Approving…' : 'Approve & Transfer'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function TransferRequestsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminService.listTransferRequests()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load transfer requests.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id, toTherapistId) {
    setActionSaving(true);
    setActionError(null);
    try {
      await adminService.approveTransferRequest(id, toTherapistId);
      setApproving(null);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve transfer.');
    } finally {
      setActionSaving(false);
    }
  }

  async function handleDeny(id) {
    if (!window.confirm('Deny this transfer request?')) return;
    setActionSaving(true);
    try {
      await adminService.denyTransferRequest(id);
      load();
    } catch {
      // surface inline — not critical
    } finally {
      setActionSaving(false);
    }
  }

  const requests = data?.requests ?? [];
  const therapists = data?.therapists ?? [];

  return (
    <div className="page owner-page">
      <div className="owner-page__breadcrumb">
        <Link to="/owner/dashboard">Dashboard</Link> / Transfer Requests
      </div>
      <h1 className="owner-page__title">Transfer Requests</h1>

      {loading && <p className="owner-loading">Loading…</p>}
      {error && <p className="owner-error">{error}</p>}

      {!loading && !error && (
        <>
          {requests.length === 0 ? (
            <div className="owner-section">
              <p className="owner-empty">No pending transfer requests.</p>
            </div>
          ) : (
            <div className="owner-section">
              <div className="owner-section__header">
                <div>
                  <h2 className="owner-section__title">Pending Requests</h2>
                  <p className="owner-section__meta">{requests.length} pending</p>
                </div>
              </div>
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th>Appointment</th>
                      <th>Client</th>
                      <th>From Therapist</th>
                      <th>Reason</th>
                      <th>Requested</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'block', fontWeight: 500 }}>{r.service_name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {formatDateTime(r.scheduled_at)}
                          </span>
                        </td>
                        <td>{r.client_name}</td>
                        <td>{r.from_first_name} {r.from_last_name}</td>
                        <td style={{ maxWidth: 200, color: '#4b5563', fontSize: '0.875rem' }}>
                          {r.reason || <em style={{ color: '#9ca3af' }}>No reason given</em>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#6b7280' }}>
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="owner-table__actions">
                          <button
                            className="btn btn--sm"
                            style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}
                            onClick={() => { setApproving(r); setActionError(null); }}
                            disabled={actionSaving}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn--sm btn--danger"
                            onClick={() => handleDeny(r.id)}
                            disabled={actionSaving}
                          >
                            Deny
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {approving && (
        <ApproveModal
          request={approving}
          therapists={therapists}
          onClose={() => { setApproving(null); setActionError(null); }}
          onApprove={handleApprove}
          saving={actionSaving}
          error={actionError}
        />
      )}
    </div>
  );
}
