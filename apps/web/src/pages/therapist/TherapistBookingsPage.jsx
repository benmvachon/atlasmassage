import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const IN_PERSON_METHOD_LABELS = { cash: 'Cash', card: 'Card terminal', check: 'Check' };
const PAYMENT_SOURCE_LABELS   = { stripe: 'Charged to card', in_person: 'Paid in-person', membership_credit: 'Membership credit' };

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
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    + ' at '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatDateLong(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }) + ' at ' + new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

// ── Transfer modal ─────────────────────────────────────────────────────────────

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
          <button className="btn btn--primary btn--sm" onClick={() => onSubmit(reason)} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose} disabled={saving}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── SOAP notes modal ───────────────────────────────────────────────────────────

const SOAP_FIELDS = [
  {
    key: 'subjective',
    label: 'S — Subjective',
    hint: 'What the client reports: symptoms, concerns, pain levels, goals for today\'s session.',
  },
  {
    key: 'objective',
    label: 'O — Objective',
    hint: 'Your direct observations and assessment findings: posture, range of motion, palpation results.',
  },
  {
    key: 'assessment',
    label: 'A — Assessment',
    hint: 'Your professional interpretation of the subjective and objective findings.',
  },
  {
    key: 'plan',
    label: 'P — Plan',
    hint: 'Techniques used, areas addressed, duration, and recommendations for future care.',
  },
];

function SoapNotesModal({ appt, onClose, onSaved }) {
  const [fields, setFields] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/appointments/${appt.id}/soap-notes`)
      .then(r => { if (r.data) setFields(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [appt.id]);

  const isComplete = SOAP_FIELDS.every(f => fields[f.key].trim());

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/appointments/${appt.id}/soap-notes`, fields);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save SOAP notes.');
    } finally {
      setSaving(false);
    }
  }

  function setField(key, value) {
    setFields(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail soap-modal" onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <div>
            <h3 className="cal-detail__title">SOAP Notes</h3>
            <p className="soap-modal__meta">
              {appt.client_name} &mdash; {appt.service_name} &mdash; {formatDateTime(appt.scheduled_at)}
            </p>
          </div>
          <button className="cal-detail__close" onClick={onClose}>&#x2715;</button>
        </div>

        {loading ? (
          <p className="soap-modal__loading">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="soap-modal__fields">
              {SOAP_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="soap-field">
                  <label className="soap-field__label" htmlFor={`soap-${key}`}>{label}</label>
                  <p className="soap-field__hint">{hint}</p>
                  <textarea
                    id={`soap-${key}`}
                    className="soap-field__textarea"
                    rows={4}
                    value={fields[key]}
                    onChange={e => setField(key, e.target.value)}
                    disabled={saving}
                    required
                  />
                </div>
              ))}
            </div>

            {error && <p className="owner-form-error">{error}</p>}

            <div className="soap-modal__actions">
              <button className="btn btn--primary btn--sm" type="submit" disabled={saving || !isComplete}>
                {saving ? 'Saving…' : 'Save SOAP Notes'}
              </button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              {!isComplete && (
                <span className="soap-modal__required-note">All four sections are required.</span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Client history modal ───────────────────────────────────────────────────────

const RECORD_TYPE_META = {
  intake:    { label: 'Intake',    className: 'history-record--intake' },
  consent:   { label: 'Consent',   className: 'history-record--consent' },
  soap:      { label: 'SOAP Notes', className: 'history-record--soap' },
  feedback:  { label: 'Feedback',  className: 'history-record--feedback' },
};

const PREGNANCY_LABELS = {
  not_pregnant:       'Not pregnant',
  pregnant:           'Currently pregnant',
  recently_pregnant:  'Recently pregnant',
  prefer_not_to_say:  'Prefer not to say',
};

function Stars({ rating }) {
  return (
    <span className="history-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={n <= rating ? 'history-star--on' : 'history-star--off'}>★</span>
      ))}
    </span>
  );
}

function RecordChip({ type }) {
  const meta = RECORD_TYPE_META[type];
  return <span className={`history-chip ${meta.className}`}>{meta.label}</span>;
}

function SessionEntry({ session }) {
  const [expanded, setExpanded] = useState(false);
  const hasRecords = !!(session.health_record_id || session.consent_id || session.soap_note_id || session.feedback_id);

  return (
    <div className="history-session">
      <button
        className="history-session__header"
        onClick={() => hasRecords && setExpanded(x => !x)}
        disabled={!hasRecords}
        aria-expanded={expanded}
      >
        <div className="history-session__info">
          <span className="history-session__date">{formatDateLong(session.scheduled_at)}</span>
          <span className="history-session__service">{session.service_name} &mdash; {session.therapist_first_name} {session.therapist_last_name}</span>
        </div>
        <div className="history-session__chips">
          {session.health_record_id && <RecordChip type="intake" />}
          {session.consent_id && <RecordChip type="consent" />}
          {session.soap_note_id && <RecordChip type="soap" />}
          {session.feedback_id && <RecordChip type="feedback" />}
          {!hasRecords && <span className="history-chip history-chip--empty">No records</span>}
        </div>
        {hasRecords && (
          <span className="history-session__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && (
        <div className="history-session__records">
          {/* Medical intake */}
          {session.health_record_id && (
            <div className="history-record history-record--intake">
              <div className="history-record__type">Medical Intake</div>
              <dl className="history-record__dl">
                {session.date_of_birth && (
                  <>
                    <dt>Date of birth</dt>
                    <dd>{new Date(session.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</dd>
                  </>
                )}
                {session.pregnancy_status && (
                  <>
                    <dt>Pregnancy status</dt>
                    <dd>{PREGNANCY_LABELS[session.pregnancy_status] ?? session.pregnancy_status}</dd>
                  </>
                )}
                {session.current_medications && (
                  <>
                    <dt>Current medications</dt>
                    <dd>{session.current_medications}</dd>
                  </>
                )}
                {session.recent_surgeries && (
                  <>
                    <dt>Recent surgeries</dt>
                    <dd>{session.recent_surgeries}</dd>
                  </>
                )}
                {session.injuries && (
                  <>
                    <dt>Injuries / limitations</dt>
                    <dd>{session.injuries}</dd>
                  </>
                )}
                {!session.date_of_birth && !session.pregnancy_status && !session.current_medications && !session.recent_surgeries && !session.injuries && (
                  <dd className="history-record__empty">No details provided.</dd>
                )}
              </dl>
              <p className="history-record__date">Recorded {formatDateShort(session.health_record_created_at)}</p>
            </div>
          )}

          {/* Consent */}
          {session.consent_id && (
            <div className="history-record history-record--consent">
              <div className="history-record__type">Consent Form</div>
              <p className="history-record__body">
                Massage therapy consent form signed and on file.
              </p>
              <p className="history-record__date">Signed {formatDateShort(session.consent_signed_at)}</p>
            </div>
          )}

          {/* SOAP notes */}
          {session.soap_note_id && (
            <div className="history-record history-record--soap">
              <div className="history-record__type">
                SOAP Notes
                <span className="history-record__author">
                  {session.soap_therapist_first_name} {session.soap_therapist_last_name}
                </span>
              </div>
              <dl className="history-record__dl">
                <dt>Subjective</dt><dd>{session.subjective}</dd>
                <dt>Objective</dt><dd>{session.objective}</dd>
                <dt>Assessment</dt><dd>{session.assessment}</dd>
                <dt>Plan</dt><dd>{session.plan}</dd>
              </dl>
              <p className="history-record__date">
                Written {formatDateShort(session.soap_updated_at ?? session.soap_created_at)}
              </p>
            </div>
          )}

          {/* Feedback */}
          {session.feedback_id && (
            <div className="history-record history-record--feedback">
              <div className="history-record__type">Client Feedback</div>
              <Stars rating={session.feedback_rating} />
              {session.feedback_comments && (
                <p className="history-record__body">&ldquo;{session.feedback_comments}&rdquo;</p>
              )}
              <p className="history-record__date">Submitted {formatDateShort(session.feedback_submitted_at)}</p>
            </div>
          )}

          {/* Session notes */}
          {session.appointment_notes && (
            <div className="history-record history-record--notes">
              <div className="history-record__type">Session Notes</div>
              <p className="history-record__body">{session.appointment_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClientHistoryModal({ appt, onClose }) {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/appointments/${appt.id}/client-history`)
      .then(r => setHistory(r.data))
      .catch(() => setError('Failed to load client history.'))
      .finally(() => setLoading(false));
  }, [appt.id]);

  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail history-modal" onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <div>
            <h3 className="cal-detail__title">Client History</h3>
            {history && (
              <p className="history-modal__client">
                {history.clientName ?? history.clientEmail}
                {history.clientName && history.clientEmail && (
                  <span className="history-modal__email"> &mdash; {history.clientEmail}</span>
                )}
              </p>
            )}
          </div>
          <button className="cal-detail__close" onClick={onClose}>&#x2715;</button>
        </div>

        {loading && <p className="history-modal__loading">Loading history…</p>}
        {error && <p className="owner-form-error">{error}</p>}

        {history && (
          <div className="history-timeline">
            {history.sessions.length === 0 ? (
              <p className="history-modal__empty">No session history found.</p>
            ) : (
              history.sessions.map(s => (
                <SessionEntry key={s.appointment_id} session={s} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Month options ──────────────────────────────────────────────────────────────

// ── In-person payment modal ────────────────────────────────────────────────────

function InPersonPaymentModal({ appt, onClose, onDone, onRebook }) {
  const [amount, setAmount] = useState(((appt.price_cents ?? 0) / 100).toFixed(2));
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/appointments/${appt.id}/record-payment`, { amountCents: cents, method });
      onDone();
      setSucceeded(true);
    } catch (err) {
      setError(err.message || 'Failed to record payment.');
      setSaving(false);
    }
  }

  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <h3 className="cal-detail__title">
            {succeeded ? 'Payment Recorded' : 'Record In-Person Payment'}
          </h3>
          <button className="cal-detail__close" onClick={onClose}>&#x2715;</button>
        </div>

        {succeeded ? (
          <div className="payment-success">
            <p className="payment-success__msg">
              Payment recorded for <strong>{appt.client_name}</strong>.
            </p>
            <p className="payment-success__prompt">Would you like to book their next appointment?</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn--primary btn--sm" type="button" onClick={onRebook}>
                Book Next Appointment
              </button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.875rem', marginBottom: '1.5rem', color: '#374151' }}>
              <strong>{appt.client_name}</strong> &mdash; {appt.service_name}
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <label className="owner-label" style={{ flex: 1 }}>
                  Amount ($)
                  <input
                    className="owner-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    disabled={saving}
                  />
                </label>
                <label className="owner-label" style={{ flex: 1 }}>
                  Method
                  <select
                    className="owner-input"
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    disabled={saving}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card terminal</option>
                    <option value="check">Check</option>
                  </select>
                </label>
              </div>
              {error && <p className="owner-form-error" style={{ marginBottom: '1rem' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
                  {saving ? 'Recording…' : 'Record Payment'}
                </button>
                <button className="btn btn--ghost btn--sm" type="button" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── No-show charge modal ───────────────────────────────────────────────────────

function NoShowChargeModal({ appt, onClose, onDone }) {
  const defaultCents = appt.price_cents ?? 0;
  const [amount, setAmount] = useState((defaultCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCharge(e) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) { setError('Enter a valid amount.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/appointments/${appt.id}/charge-no-show`, { amountCents: cents });
      onDone();
    } catch (err) {
      setError(err.message || 'Failed to charge card.');
      setSaving(false);
    }
  }

  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <h3 className="cal-detail__title">Charge No-Show Fee</h3>
          <button className="cal-detail__close" onClick={onClose}>&#x2715;</button>
        </div>
        <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: '0.875rem', marginBottom: '1.5rem', color: '#374151' }}>
          <strong>{appt.client_name}</strong> did not appear for their <strong>{appt.service_name}</strong> appointment.
          Their card on file will be charged.
        </p>
        <form onSubmit={handleCharge} noValidate>
          <label className="owner-label" style={{ marginBottom: '1rem', display: 'block' }}>
            Amount ($)
            <input
              className="owner-input"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              disabled={saving}
            />
          </label>
          {error && <p className="owner-form-error" style={{ marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn--primary btn--sm" type="submit" disabled={saving}>
              {saving ? 'Charging…' : 'Charge Card'}
            </button>
            <button className="btn btn--ghost btn--sm" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
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
  for (let i = 1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.splice(1, 0, { value, label });
  }
  return options;
}

const MONTH_OPTIONS = generateMonthOptions();

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TherapistBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const [soapAppt, setSoapAppt] = useState(null);
  const [historyAppt, setHistoryAppt] = useState(null);
  const [paymentAppt, setPaymentAppt] = useState(null);
  const [noShowAppt, setNoShowAppt] = useState(null);

  // Rows whose payment was recorded this session (local optimistic update).
  const [paidIds, setPaidIds] = useState(new Set());

  // Ref for the row to scroll into view when ?appt= is set.
  const highlightRef = useRef(null);

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

  // When the page is opened via the payment-prompt email link (?appt=UUID),
  // wait for appointments to load, then auto-open the appropriate payment modal.
  const deepLinkApptId = searchParams.get('appt');
  useEffect(() => {
    if (!deepLinkApptId || loading || appointments.length === 0) return;
    const appt = appointments.find(a => a.id === deepLinkApptId);
    if (!appt) return;
    // Scroll the row into view.
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Open the right modal.
    if (appt.status === 'no_show' && appt.stripe_payment_method_id && !paidIds.has(appt.id) && !appt.payment_id) {
      setNoShowAppt(appt);
    } else if (appt.status === 'completed' && !paidIds.has(appt.id) && !appt.payment_id) {
      setPaymentAppt(appt);
    }
    // Remove the query param so a refresh doesn't re-open the modal.
    setSearchParams({}, { replace: true });
  }, [deepLinkApptId, loading, appointments]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const needsSoap = appt =>
    (appt.status === 'completed' || appt.status === 'no_show') && !appt.has_soap_notes;

  const isPaid = appt => paidIds.has(appt.id) || !!appt.payment_id;

  const canRecordPayment = appt =>
    appt.status === 'completed' && !isPaid(appt);

  const canChargeNoShow = appt =>
    appt.status === 'no_show' && !!appt.stripe_payment_method_id && !isPaid(appt);

  return (
    <div className="page owner-page owner-page--wide">
      <h1 className="owner-page__title">My Bookings</h1>

      <div className="bookings-filters">
        <select className="owner-input bookings-filters__select" value={month} onChange={e => setMonth(e.target.value)}>
          {MONTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select className="owner-input bookings-filters__select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            <button type="button" className="btn btn--ghost btn--sm" onClick={clearClientSearch}>Clear</button>
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
                      <th>Table</th>
                      <th>Consent</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(appt => {
                      const isHighlighted = appt.id === deepLinkApptId;
                      return (
                      <tr
                        key={appt.id}
                        ref={isHighlighted ? highlightRef : null}
                        className={[
                          appt.status === 'cancelled' ? 'owner-row--inactive' : '',
                          isHighlighted ? 'owner-row--highlighted' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(appt.scheduled_at)}</td>
                        <td>
                          <span className="therapist-name">{appt.client_name}</span>
                          {appt.client_email && (
                            <span className="owner-service-desc">{appt.client_email}</span>
                          )}
                        </td>
                        <td>{appt.service_name}</td>
                        <td>{appt.duration_minutes} min</td>
                        <td>{appt.bed_name || '—'}</td>
                        <td>
                          {appt.consent_signed_at
                            ? <span className="owner-badge owner-badge--active">On file</span>
                            : <span className="owner-badge owner-badge--inactive">—</span>
                          }
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                            <span className={`cal-status cal-status--${appt.status}`}>
                              {STATUS_LABELS[appt.status]}
                            </span>
                            {appt.transfer_request_id && (
                              <span className="cal-status cal-status--transfer">Transfer Requested</span>
                            )}
                            {needsSoap(appt) && (
                              <span className="soap-badge soap-badge--missing" title="SOAP notes required">
                                SOAP notes missing
                              </span>
                            )}
                            {(appt.status === 'completed' || appt.status === 'no_show') && appt.has_soap_notes && (
                              <span className="soap-badge soap-badge--done">SOAP ✓</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {isPaid(appt) ? (
                            <span className="owner-badge owner-badge--active">
                              {appt.payment_source
                                ? PAYMENT_SOURCE_LABELS[appt.payment_source] ?? appt.payment_source
                                : 'Paid'}
                              {appt.payment_in_person_method
                                ? ` (${IN_PERSON_METHOD_LABELS[appt.payment_in_person_method] ?? appt.payment_in_person_method})`
                                : ''}
                            </span>
                          ) : appt.stripe_payment_method_id && (appt.status === 'completed' || appt.status === 'no_show') ? (
                            <span className="owner-badge owner-badge--inactive" title="Card on file — no payment recorded yet">
                              Card on file
                            </span>
                          ) : (
                            <span className="owner-badge owner-badge--inactive">—</span>
                          )}
                        </td>
                        <td className="owner-table__actions">
                          <div className="bookings-actions">
                            {canRequestTransfer(appt) && (
                              <button className="btn btn--outline btn--sm" onClick={() => setTransferAppt(appt)}>
                                Request Transfer
                              </button>
                            )}
                            {canRecordPayment(appt) && (
                              <button className="btn btn--primary btn--sm" onClick={() => setPaymentAppt(appt)}>
                                Record Payment
                              </button>
                            )}
                            {canChargeNoShow(appt) && (
                              <button className="btn btn--primary btn--sm" onClick={() => setNoShowAppt(appt)}>
                                Charge No-Show
                              </button>
                            )}
                            {(appt.status === 'completed' || appt.status === 'no_show') && (
                              <button
                                className={`btn btn--sm ${needsSoap(appt) ? 'btn--primary' : 'btn--outline'}`}
                                onClick={() => setSoapAppt(appt)}
                              >
                                {appt.has_soap_notes ? 'Edit SOAP Notes' : 'Write SOAP Notes'}
                              </button>
                            )}
                            <button className="btn btn--ghost btn--sm" onClick={() => setHistoryAppt(appt)}>
                              Client History
                            </button>
                          </div>
                          {appt.transfer_request_id && !canRequestTransfer(appt) && (
                            <span className="bookings-transfer-badge">Transfer pending</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
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

      {soapAppt && (
        <SoapNotesModal
          appt={soapAppt}
          onClose={() => setSoapAppt(null)}
          onSaved={load}
        />
      )}

      {historyAppt && (
        <ClientHistoryModal
          appt={historyAppt}
          onClose={() => setHistoryAppt(null)}
        />
      )}

      {paymentAppt && (
        <InPersonPaymentModal
          appt={paymentAppt}
          onClose={() => setPaymentAppt(null)}
          onDone={() => {
            setPaidIds(prev => new Set([...prev, paymentAppt.id]));
          }}
          onRebook={() => {
            setPaymentAppt(null);
            const params = new URLSearchParams();
            if (user?.id) params.set('therapistId', user.id);
            navigate(`/booking?${params}`);
          }}
        />
      )}

      {noShowAppt && (
        <NoShowChargeModal
          appt={noShowAppt}
          onClose={() => setNoShowAppt(null)}
          onDone={() => {
            setPaidIds(prev => new Set([...prev, noShowAppt.id]));
            setNoShowAppt(null);
          }}
        />
      )}
    </div>
  );
}
