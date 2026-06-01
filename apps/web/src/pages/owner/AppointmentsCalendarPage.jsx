import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService.js';

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show:   'No Show',
};

const STATUS_NEXT = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
  completed: [],
  no_show:   [],
  cancelled: [],
};

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMonth(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function AppointmentDetail({ appt, onClose, onStatusChange, saving }) {
  const nexts = STATUS_NEXT[appt.status] || [];
  return (
    <div className="cal-detail-overlay" onClick={onClose}>
      <div className="cal-detail" onClick={e => e.stopPropagation()}>
        <div className="cal-detail__header">
          <h3 className="cal-detail__title">{appt.service_name}</h3>
          <button className="cal-detail__close" onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>
        <dl className="cal-detail__grid">
          <dt>Client</dt>
          <dd>{appt.client_name || '—'}</dd>
          <dt>Email</dt>
          <dd>{appt.client_email || '—'}</dd>
          {appt.client_phone && <><dt>Phone</dt><dd>{appt.client_phone}</dd></>}
          {appt.guest_phone && !appt.client_phone && <><dt>Phone</dt><dd>{appt.guest_phone}</dd></>}
          <dt>Therapist</dt>
          <dd>{appt.therapist_first_name} {appt.therapist_last_name}</dd>
          <dt>Time</dt>
          <dd>{formatTime(appt.scheduled_at)} &mdash; {appt.duration_minutes} min</dd>
          <dt>Price</dt>
          <dd>${(appt.price_cents / 100).toFixed(2)}</dd>
          <dt>Status</dt>
          <dd><span className={`cal-status cal-status--${appt.status}`}>{STATUS_LABELS[appt.status]}</span></dd>
          {appt.notes && <><dt>Notes</dt><dd>{appt.notes}</dd></>}
        </dl>
        {nexts.length > 0 && (
          <div className="cal-detail__actions">
            <p className="cal-detail__actions-label">Update status:</p>
            <div className="cal-detail__btns">
              {nexts.map(s => (
                <button
                  key={s}
                  className={`btn btn--sm cal-detail__status-btn cal-detail__status-btn--${s}`}
                  onClick={() => onStatusChange(appt.id, s)}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekView({ weekStart, appointments, onSelectAppt }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = toISODate(new Date());

  const byDay = {};
  appointments.forEach(a => {
    const day = toISODate(new Date(a.scheduled_at));
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(a);
  });

  return (
    <div className="cal-week">
      {days.map(day => {
        const key = toISODate(day);
        const isToday = key === today;
        const dayAppts = byDay[key] || [];
        return (
          <div key={key} className={`cal-week__day${isToday ? ' cal-week__day--today' : ''}`}>
            <div className="cal-week__day-header">
              <span className="cal-week__day-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className={`cal-week__day-num${isToday ? ' cal-week__day-num--today' : ''}`}>
                {day.getDate()}
              </span>
            </div>
            <div className="cal-week__day-appts">
              {dayAppts.length === 0 && (
                <p className="cal-week__empty">No appointments</p>
              )}
              {dayAppts.map(a => (
                <button
                  key={a.id}
                  className={`cal-appt cal-appt--${a.status}`}
                  onClick={() => onSelectAppt(a)}
                >
                  <span className="cal-appt__time">{formatTime(a.scheduled_at)}</span>
                  <span className="cal-appt__name">{a.client_name}</span>
                  <span className="cal-appt__service">{a.service_name}</span>
                  <span className={`cal-status cal-status--${a.status}`}>{STATUS_LABELS[a.status]}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ monthStart, appointments, onSelectAppt }) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toISODate(new Date());

  const byDay = {};
  appointments.forEach(a => {
    const day = toISODate(new Date(a.scheduled_at));
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(a);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="cal-month">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
        <div key={d} className="cal-month__head">{d}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={`e${i}`} className="cal-month__cell cal-month__cell--empty" />;
        const key = toISODate(day);
        const isToday = key === today;
        const dayAppts = byDay[key] || [];
        return (
          <div key={key} className={`cal-month__cell${isToday ? ' cal-month__cell--today' : ''}`}>
            <span className={`cal-month__day-num${isToday ? ' cal-month__day-num--today' : ''}`}>
              {day.getDate()}
            </span>
            {dayAppts.slice(0, 3).map(a => (
              <button
                key={a.id}
                className={`cal-month__appt cal-appt--${a.status}`}
                onClick={() => onSelectAppt(a)}
              >
                <span className="cal-month__appt-time">{formatTime(a.scheduled_at)}</span>
                <span className="cal-month__appt-name">{a.client_name}</span>
              </button>
            ))}
            {dayAppts.length > 3 && (
              <span className="cal-month__more">+{dayAppts.length - 3} more</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListView({ appointments, onSelectAppt }) {
  if (appointments.length === 0) {
    return <p className="owner-empty">No appointments in this range.</p>;
  }

  const grouped = {};
  appointments.forEach(a => {
    const day = toISODate(new Date(a.scheduled_at));
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(a);
  });

  return (
    <div className="cal-list">
      {Object.entries(grouped).map(([day, appts]) => (
        <div key={day} className="cal-list__group">
          <h3 className="cal-list__date">{formatDate(new Date(day + 'T00:00:00'))}</h3>
          {appts.map(a => (
            <button key={a.id} className="cal-list__appt" onClick={() => onSelectAppt(a)}>
              <span className="cal-list__time">{formatTime(a.scheduled_at)}</span>
              <span className="cal-list__body">
                <span className="cal-list__client">{a.client_name}</span>
                <span className="cal-list__meta">
                  {a.service_name} &middot; {a.therapist_first_name} {a.therapist_last_name} &middot; {a.duration_minutes} min
                </span>
              </span>
              <span className={`cal-status cal-status--${a.status}`}>{STATUS_LABELS[a.status]}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AppointmentsCalendarPage() {
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(new Date());
  const [therapistId, setTherapistId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const getRange = useCallback(() => {
    if (view === 'week') {
      const ws = startOfWeek(anchor);
      return { start: toISODate(ws), end: toISODate(addDays(ws, 6)) };
    }
    if (view === 'month') {
      const ms = startOfMonth(anchor);
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
      return { start: toISODate(ms), end: toISODate(me) };
    }
    // list: 30-day window
    const s = new Date(anchor);
    s.setHours(0, 0, 0, 0);
    return { start: toISODate(s), end: toISODate(addDays(s, 29)) };
  }, [view, anchor]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const { start, end } = getRange();
    adminService.listAppointments(start, end, therapistId || undefined)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load appointments.'))
      .finally(() => setLoading(false));
  }, [getRange, therapistId]);

  useEffect(() => { load(); }, [load]);

  function navigate(dir) {
    setAnchor(prev => {
      if (view === 'week') return addDays(prev, dir * 7);
      if (view === 'month') return new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
      return addDays(prev, dir * 30);
    });
  }

  function goToday() { setAnchor(new Date()); }

  function getTitle() {
    if (view === 'week') {
      const ws = startOfWeek(anchor);
      const we = addDays(ws, 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.toLocaleDateString('en-US', { month: 'long' })} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`;
      }
      return `${formatDate(ws)} – ${formatDate(we)}`;
    }
    if (view === 'month') return formatMonth(anchor);
    return `${formatDate(anchor)} – ${formatDate(addDays(anchor, 29))}`;
  }

  async function handleStatusChange(id, status) {
    setSaving(true);
    try {
      await adminService.updateAppointmentStatus(id, status);
      setSelected(prev => prev ? { ...prev, status } : null);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          appointments: prev.appointments.map(a => a.id === id ? { ...a, status } : a),
        };
      });
    } catch {
      // silently ignore; user sees old status
    } finally {
      setSaving(false);
    }
  }

  const appointments = data?.appointments || [];
  const therapists = data?.therapists || [];

  return (
    <div className="page owner-page">
      <div className="owner-page__breadcrumb">
        <Link to="/owner/dashboard">Dashboard</Link> / Booking Calendar
      </div>
      <h1 className="owner-page__title">Booking Calendar</h1>

      <div className="cal-toolbar">
        <div className="cal-toolbar__left">
          <button className="btn btn--outline btn--sm" onClick={goToday}>Today</button>
          <button className="btn btn--ghost btn--sm cal-nav" onClick={() => navigate(-1)} aria-label="Previous">&#8249;</button>
          <button className="btn btn--ghost btn--sm cal-nav" onClick={() => navigate(1)} aria-label="Next">&#8250;</button>
          <span className="cal-toolbar__title">{getTitle()}</span>
        </div>
        <div className="cal-toolbar__right">
          {therapists.length > 0 && (
            <select
              className="owner-input cal-filter"
              value={therapistId}
              onChange={e => setTherapistId(e.target.value)}
            >
              <option value="">All Therapists</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
              ))}
            </select>
          )}
          <div className="cal-view-toggle">
            {['week', 'month', 'list'].map(v => (
              <button
                key={v}
                className={`cal-view-btn${view === v ? ' cal-view-btn--active' : ''}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="owner-loading">Loading appointments…</p>}
      {error && <p className="owner-error">{error}</p>}

      {!loading && !error && (
        <>
          {view === 'week' && (
            <WeekView
              weekStart={startOfWeek(anchor)}
              appointments={appointments}
              onSelectAppt={setSelected}
            />
          )}
          {view === 'month' && (
            <MonthView
              monthStart={startOfMonth(anchor)}
              appointments={appointments}
              onSelectAppt={setSelected}
            />
          )}
          {view === 'list' && (
            <ListView appointments={appointments} onSelectAppt={setSelected} />
          )}
        </>
      )}

      {selected && (
        <AppointmentDetail
          appt={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          saving={saving}
        />
      )}
    </div>
  );
}
