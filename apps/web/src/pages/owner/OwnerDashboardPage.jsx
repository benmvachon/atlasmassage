import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminService } from '../../services/adminService.js';

function StatCard({ label, value, sub, to }) {
  const inner = (
    <div className="dash-stat">
      <span className="dash-stat__value">{value}</span>
      <span className="dash-stat__label">{label}</span>
      {sub && <span className="dash-stat__sub">{sub}</span>}
    </div>
  );
  return to ? <Link to={to} className="dash-stat-link">{inner}</Link> : inner;
}

function formatDollars(cents) {
  if (!cents && cents !== 0) return '—';
  return '$' + (Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getDashboard()
      .then(r => setStats(r.data))
      .catch(() => setError('Could not load dashboard stats.'));
  }, []);

  return (
    <div className="page owner-hub">
      <div className="owner-hub__header">
        <h1>Welcome back, {user?.first_name}.</h1>
        <p className="owner-hub__greeting">Here&rsquo;s what&rsquo;s happening today.</p>
      </div>

      {error && <p className="owner-error">{error}</p>}

      {stats && (
        <div className="dash-stats-row">
          <StatCard
            label="Today's Appointments"
            value={stats.today_appointments ?? 0}
            to="/owner/appointments"
          />
          <StatCard
            label="Pending Confirmation"
            value={stats.pending_appointments ?? 0}
            to="/owner/appointments"
          />
          <StatCard
            label="Revenue This Month"
            value={formatDollars(stats.month_revenue_cents)}
            sub="current calendar month"
            to="/owner/revenue"
          />
          <StatCard
            label="Revenue This Week"
            value={formatDollars(stats.week_revenue_cents)}
            sub="last 7 days"
            to="/owner/revenue"
          />
          <StatCard
            label="Active Memberships"
            value={stats.active_memberships ?? 0}
            to="/owner/revenue"
          />
        </div>
      )}

      <div className="owner-hub__grid owner-hub__grid--3">
        <Link to="/owner/appointments" className="owner-hub__card">
          <h2 className="owner-hub__card-title">Booking Calendar</h2>
          <p className="owner-hub__card-desc">
            View and manage all appointments by week or month, filter by therapist,
            and update booking statuses.
          </p>
          <span className="owner-hub__card-cta">Open Calendar &rarr;</span>
        </Link>
        <Link to="/owner/revenue" className="owner-hub__card">
          <h2 className="owner-hub__card-title">Revenue &amp; Analytics</h2>
          <p className="owner-hub__card-desc">
            Daily revenue charts, breakdowns by service and therapist, and
            membership subscription data.
          </p>
          <span className="owner-hub__card-cta">View Revenue &rarr;</span>
        </Link>
        <Link to="/owner/business" className="owner-hub__card">
          <h2 className="owner-hub__card-title">Business Details</h2>
          <p className="owner-hub__card-desc">
            Manage operating hours, massage tables, and service offerings.
          </p>
          <span className="owner-hub__card-cta">Manage &rarr;</span>
        </Link>
        <Link to="/owner/therapists" className="owner-hub__card">
          <h2 className="owner-hub__card-title">Therapist Management</h2>
          <p className="owner-hub__card-desc">
            Add, edit, and manage your team of licensed therapists.
          </p>
          <span className="owner-hub__card-cta">Manage &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
