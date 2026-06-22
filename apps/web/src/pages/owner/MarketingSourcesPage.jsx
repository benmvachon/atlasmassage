import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminService } from '../../services/adminService.js';

const PALETTE = ['#2c6e49', '#4c956c', '#d4a373', '#a3b18a', '#588157', '#3a5a40', '#dad7cd'];

function dollars(cents) {
  if (!cents && cents !== 0) return '$0.00';
  return '$' + (Number(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
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

const TOUCHES = [
  { label: 'First-touch', value: 'first' },
  { label: 'Last-touch', value: 'last' },
];

function toISODate(d) { return d.toISOString().slice(0, 10); }

export default function MarketingSourcesPage() {
  const [range, setRange] = useState(30);
  const [touch, setTouch] = useState('first');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const end = toISODate(new Date());
    const start = toISODate(new Date(Date.now() - (range - 1) * 86400000));
    adminService.getMarketingSources(start, end, touch)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load marketing data.'))
      .finally(() => setLoading(false));
  }, [range, touch]);

  const Header = (
    <div className="owner-page__breadcrumb">
      <Link to="/owner/dashboard">Dashboard</Link> / Marketing Sources
    </div>
  );

  if (loading) return (
    <div className="page owner-page">
      {Header}
      <h1 className="owner-page__title">Marketing Sources</h1>
      <p className="owner-loading">Loading marketing data…</p>
    </div>
  );

  if (error) return (
    <div className="page owner-page">
      {Header}
      <h1 className="owner-page__title">Marketing Sources</h1>
      <p className="owner-error">{error}</p>
    </div>
  );

  const { bySource = [], byCampaign = [], summary = {} } = data || {};

  const sourceForChart = bySource.map(r => ({
    name: r.source,
    Revenue: Number(r.total_cents || 0),
    Appointments: Number(r.appointment_count || 0),
  }));

  const touchLabel = touch === 'last' ? 'last-touch' : 'first-touch';

  return (
    <div className="page owner-page owner-page--wide">
      {Header}
      <div className="rev-page-header">
        <h1 className="owner-page__title" style={{ marginBottom: 0 }}>Marketing Sources</h1>
        <div className="rev-range-toggle">
          {TOUCHES.map(t => (
            <button
              key={t.value}
              className={`cal-view-btn${touch === t.value ? ' cal-view-btn--active' : ''}`}
              onClick={() => setTouch(t.value)}
            >
              {t.label}
            </button>
          ))}
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

      <p className="owner-section__meta" style={{ marginTop: 4 }}>
        Attributing each booking to its {touchLabel} channel. Confirmed &amp; completed appointments only.
      </p>

      {/* Summary stats */}
      <div className="rev-stats-row">
        <SummaryCard
          label="Attributed Revenue"
          value={dollars(summary.total_cents)}
          sub={`last ${range} days`}
        />
        <SummaryCard
          label="Appointments"
          value={summary.appointment_count ?? 0}
          sub={`${touchLabel}`}
        />
        <SummaryCard
          label="Channels"
          value={bySource.length}
          sub="distinct sources"
        />
      </div>

      {/* Source breakdown: bar + pie */}
      <div className="rev-two-col">
        <div className="owner-section">
          <div className="owner-section__header">
            <div>
              <h2 className="owner-section__title">Appointments by Source</h2>
              <p className="owner-section__meta">Bookings attributed to each channel</p>
            </div>
          </div>
          {sourceForChart.length === 0 ? (
            <p className="owner-empty">No appointment data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sourceForChart} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={110} />
                <Tooltip formatter={(v, name) => [v, name]} />
                <Bar dataKey="Appointments" fill="#2c6e49" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="owner-section">
          <div className="owner-section__header">
            <div>
              <h2 className="owner-section__title">Revenue Share by Source</h2>
              <p className="owner-section__meta">Service revenue attributed to each channel</p>
            </div>
          </div>
          {sourceForChart.length === 0 ? (
            <p className="owner-empty">No appointment data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sourceForChart}
                  dataKey="Revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  labelLine={false}
                  label={PieLabel}
                >
                  {sourceForChart.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [dollars(v), name]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Campaign breakdown table */}
      <div className="owner-section">
        <div className="owner-section__header">
          <div>
            <h2 className="owner-section__title">Source / Medium / Campaign</h2>
            <p className="owner-section__meta">Full {touchLabel} breakdown</p>
          </div>
        </div>
        {byCampaign.length === 0 ? (
          <p className="owner-empty">No appointment data for this period.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Medium</th>
                  <th>Campaign</th>
                  <th>Appts</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map((r, i) => (
                  <tr key={`${r.source}-${r.medium}-${r.campaign}-${i}`}>
                    <td>{r.source}</td>
                    <td>{r.medium || '—'}</td>
                    <td>{r.campaign || '—'}</td>
                    <td>{r.appointment_count}</td>
                    <td>{dollars(r.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
