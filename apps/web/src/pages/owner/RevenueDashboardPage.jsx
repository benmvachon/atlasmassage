import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { adminService } from '../../services/adminService.js';

const PALETTE = ['#2c6e49', '#4c956c', '#d4a373', '#a3b18a', '#588157', '#3a5a40', '#dad7cd'];

function dollars(cents) {
  if (!cents && cents !== 0) return '$0.00';
  return '$' + (Number(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function shortDollars(cents) {
  const n = Number(cents) / 100;
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
}

function DollarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rev-tooltip">
      <p className="rev-tooltip__label">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {dollars(p.value)}
        </p>
      ))}
    </div>
  );
}

function CountDollarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rev-tooltip">
      <p className="rev-tooltip__label">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name.includes('Revenue') ? dollars(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, percent }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="rev-stat">
      <span className="rev-stat__value">{value}</span>
      <span className="rev-stat__label">{label}</span>
      {sub && <span className="rev-stat__sub">{sub}</span>}
    </div>
  );
}

const RANGES = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
];

function toISODate(d) { return d.toISOString().slice(0, 10); }

export default function RevenueDashboardPage() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const end = toISODate(new Date());
    const start = toISODate(new Date(Date.now() - (range - 1) * 86400000));
    adminService.getRevenue(start, end)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load revenue data.'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return (
    <div className="page owner-page">
      <div className="owner-page__breadcrumb"><Link to="/owner/dashboard">Dashboard</Link> / Revenue</div>
      <h1 className="owner-page__title">Revenue &amp; Analytics</h1>
      <p className="owner-loading">Loading revenue data…</p>
    </div>
  );

  if (error) return (
    <div className="page owner-page">
      <div className="owner-page__breadcrumb"><Link to="/owner/dashboard">Dashboard</Link> / Revenue</div>
      <h1 className="owner-page__title">Revenue &amp; Analytics</h1>
      <p className="owner-error">{error}</p>
    </div>
  );

  const { daily = [], byService = [], byTherapist = [], summary = {}, memberships = [] } = data || {};

  const dailyForChart = daily.map(r => ({
    day: r.day?.slice(5),
    'Revenue': Number(r.total_cents || 0),
    Payments: Number(r.payment_count || 0),
  }));

  const serviceForChart = byService.map(r => ({
    name: r.service_name,
    'Revenue': Number(r.total_cents || 0),
    Appointments: Number(r.appointment_count || 0),
  }));

  const therapistForChart = byTherapist.map(r => ({
    name: r.therapist_name,
    'Revenue': Number(r.total_cents || 0),
    Appointments: Number(r.appointment_count || 0),
  }));

  const totalMembershipMonthly = memberships.reduce((s, m) => s + Number(m.monthly_cents || 0), 0);
  const totalMembershipCount = memberships.reduce((s, m) => s + Number(m.active_count || 0), 0);

  return (
    <div className="page owner-page owner-page--wide">
      <div className="owner-page__breadcrumb">
        <Link to="/owner/dashboard">Dashboard</Link> / Revenue &amp; Analytics
      </div>
      <div className="rev-page-header">
        <h1 className="owner-page__title" style={{ marginBottom: 0 }}>Revenue &amp; Analytics</h1>
        <div className="rev-range-toggle">
          {RANGES.map(r => (
            <button
              key={r.days}
              className={`cal-view-btn${range === r.days ? ' cal-view-btn--active' : ''}`}
              onClick={() => setRange(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="rev-stats-row">
        <SummaryCard
          label="Total Revenue"
          value={dollars(summary.succeeded_cents)}
          sub={`last ${range} days`}
        />
        <SummaryCard
          label="Payments"
          value={summary.succeeded_count ?? 0}
          sub="succeeded"
        />
        <SummaryCard
          label="Refunds"
          value={dollars(summary.refunded_cents)}
          sub={`${summary.refunded_count ?? 0} transactions`}
        />
        <SummaryCard
          label="Active Memberships"
          value={totalMembershipCount}
          sub={`${dollars(totalMembershipMonthly)}/mo MRR`}
        />
      </div>

      {/* Daily revenue chart */}
      <div className="owner-section">
        <div className="owner-section__header">
          <div>
            <h2 className="owner-section__title">Daily Revenue</h2>
            <p className="owner-section__meta">Succeeded payments by day</p>
          </div>
        </div>
        {dailyForChart.length === 0 ? (
          <p className="owner-empty">No payment data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyForChart} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tickFormatter={v => shortDollars(v)} tick={{ fontSize: 11, fill: '#6b7280' }} width={56} />
              <Tooltip content={<DollarTooltip />} />
              <Bar dataKey="Revenue" fill="#2c6e49" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Service and therapist breakdown side-by-side */}
      <div className="rev-two-col">
        {/* Revenue by service */}
        <div className="owner-section">
          <div className="owner-section__header">
            <div>
              <h2 className="owner-section__title">By Service</h2>
              <p className="owner-section__meta">Confirmed &amp; completed appointments</p>
            </div>
          </div>
          {serviceForChart.length === 0 ? (
            <p className="owner-empty">No appointment data.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={serviceForChart}
                    dataKey="Revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    labelLine={false}
                    label={PieLabel}
                  >
                    {serviceForChart.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [dollars(v), name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Appts</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceForChart.map((r, i) => (
                      <tr key={r.name}>
                        <td>
                          <span className="rev-swatch" style={{ background: PALETTE[i % PALETTE.length] }} />
                          {r.name}
                        </td>
                        <td>{r.Appointments}</td>
                        <td>{dollars(r.Revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Revenue by therapist */}
        <div className="owner-section">
          <div className="owner-section__header">
            <div>
              <h2 className="owner-section__title">By Therapist</h2>
              <p className="owner-section__meta">Confirmed &amp; completed appointments</p>
            </div>
          </div>
          {therapistForChart.length === 0 ? (
            <p className="owner-empty">No appointment data.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={therapistForChart} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => shortDollars(v)} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={90} />
                  <Tooltip content={<CountDollarTooltip />} />
                  <Bar dataKey="Revenue" fill="#4c956c" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="owner-table-wrapper">
                <table className="owner-table">
                  <thead>
                    <tr>
                      <th>Therapist</th>
                      <th>Appts</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {therapistForChart.map(r => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{r.Appointments}</td>
                        <td>{dollars(r.Revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Memberships */}
      {memberships.length > 0 && (
        <div className="owner-section">
          <div className="owner-section__header">
            <div>
              <h2 className="owner-section__title">Active Memberships</h2>
              <p className="owner-section__meta">Current subscription breakdown</p>
            </div>
          </div>
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Active Members</th>
                  <th>Monthly Revenue</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map(m => (
                  <tr key={m.plan_name}>
                    <td>{m.plan_name}</td>
                    <td>{m.active_count}</td>
                    <td>{dollars(m.monthly_cents)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 600, borderTop: '2px solid #d1d5db' }}>
                  <td>Total MRR</td>
                  <td>{totalMembershipCount}</td>
                  <td>{dollars(totalMembershipMonthly)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
