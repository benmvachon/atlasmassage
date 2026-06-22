import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { adminService } from '../../services/adminService.js';

const PALETTE = ['#2c6e49', '#4c956c', '#d4a373', '#a3b18a', '#588157', '#3a5a40', '#bcb8b1'];
const PAGE_SIZE = 25;
const TOP_SOURCES = 6;

const RANGES = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
];

const TOUCHES = [
  { label: 'First-touch', value: 'first' },
  { label: 'Last-touch', value: 'last' },
];

const METRICS = [
  { label: 'Appointments', value: 'appointment_count' },
  { label: 'Revenue', value: 'total_cents' },
];

const STATUSES = [
  { label: 'Confirmed & Completed', value: '' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Pending', value: 'pending' },
];

function toISODate(d) { return d.toISOString().slice(0, 10); }

function dollars(cents) {
  if (cents === null || cents === undefined) return '$0.00';
  return '$' + (Number(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Pivot the flat {date, source, metric} series into one record per date keyed by source,
// collapsing all but the top sources into "Other" so the stacked chart stays legible.
function pivotSeries(series, metric) {
  const totals = {};
  for (const r of series) totals[r.source] = (totals[r.source] || 0) + Number(r[metric] || 0);
  const top = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SOURCES)
    .map(([s]) => s);
  const topSet = new Set(top);

  const byDate = new Map();
  let hasOther = false;
  for (const r of series) {
    if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date });
    const rec = byDate.get(r.date);
    const key = topSet.has(r.source) ? r.source : (hasOther = true, 'Other');
    const val = metric === 'total_cents' ? Number(r[metric] || 0) / 100 : Number(r[metric] || 0);
    rec[key] = (rec[key] || 0) + val;
  }

  const keys = hasOther ? [...top, 'Other'] : top;
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, keys };
}

export default function MarketingAnalyticsPage() {
  // ── Time range + breakdown filters ───────────────────────────────────────────
  const [start, setStart] = useState(() => toISODate(new Date(Date.now() - 29 * 86400000)));
  const [end, setEnd] = useState(() => toISODate(new Date()));
  const [touch, setTouch] = useState('first');
  const [metric, setMetric] = useState('appointment_count');

  // ── List filters ──────────────────────────────────────────────────────────────
  const [source, setSource] = useState('');
  const [medium, setMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [status, setStatus] = useState('');

  // ── Chart / filter-option data (from the aggregate endpoints) ──────────────────
  const [sources, setSources] = useState(null);
  const [series, setSeries] = useState(null);
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    setChartError(null);
    setSources(null);
    setSeries(null);
    Promise.all([
      adminService.getMarketingSources(start, end, touch),
      adminService.getAttributionTimeseries(start, end, touch),
    ])
      .then(([srcRes, tsRes]) => {
        setSources(srcRes.data);
        setSeries(tsRes.data.series);
      })
      .catch(() => setChartError('Failed to load analytics.'));
  }, [start, end, touch]);

  // Filter dropdown options derived from the aggregate breakdown for this range/touch.
  const sourceOptions = useMemo(() => (sources?.bySource ?? []).map(r => r.source), [sources]);
  const mediumOptions = useMemo(
    () => [...new Set((sources?.byCampaign ?? []).map(r => r.medium).filter(Boolean))],
    [sources]
  );
  const campaignOptions = useMemo(
    () => [...new Set((sources?.byCampaign ?? []).map(r => r.campaign).filter(Boolean))],
    [sources]
  );

  const { rows: chartRows, keys: chartKeys } = useMemo(
    () => (series ? pivotSeries(series, metric) : { rows: [], keys: [] }),
    [series, metric]
  );

  // ── Infinite-scrolling appointment list ────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [listError, setListError] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const cursorRef = useRef(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  const filtersKey = JSON.stringify({ start, end, touch, source, medium, campaign, status });

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setListLoading(true);
    setListError(null);
    try {
      const res = await adminService.listAttributedAppointments({
        start, end, touch, source, medium, campaign, status,
        cursor: cursorRef.current, limit: PAGE_SIZE,
      });
      const { appointments, nextCursor } = res.data;
      setItems(prev => [...prev, ...appointments]);
      cursorRef.current = nextCursor;
      hasMoreRef.current = !!nextCursor;
    } catch {
      setListError('Failed to load appointments.');
      hasMoreRef.current = false;
    } finally {
      loadingRef.current = false;
      setListLoading(false);
    }
  }, [start, end, touch, source, medium, campaign, status]);

  // Reset and load the first page whenever any filter changes.
  useEffect(() => {
    cursorRef.current = null;
    hasMoreRef.current = true;
    loadingRef.current = false;
    setItems([]);
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Sentinel observer: fetch the next page when the bottom of the list scrolls into view.
  const sentinelRef = useRef(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Range helpers ───────────────────────────────────────────────────────────────
  const activeRangeDays = useMemo(() => {
    const diff = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    return diff;
  }, [start, end]);

  function applyPreset(days) {
    setEnd(toISODate(new Date()));
    setStart(toISODate(new Date(Date.now() - (days - 1) * 86400000)));
  }

  const touchLabel = touch === 'last' ? 'last-touch' : 'first-touch';

  const Header = (
    <div className="owner-page__breadcrumb">
      <Link to="/owner/dashboard">Dashboard</Link> / Marketing Analytics
    </div>
  );

  return (
    <div className="page owner-page owner-page--wide">
      {Header}
      <div className="rev-page-header">
        <h1 className="owner-page__title" style={{ marginBottom: 0 }}>Marketing Analytics</h1>
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
        </div>
      </div>

      {/* Time range */}
      <div className="mkt-range">
        <div className="rev-range-toggle">
          {RANGES.map(r => (
            <button
              key={r.days}
              className={`cal-view-btn${activeRangeDays === r.days ? ' cal-view-btn--active' : ''}`}
              onClick={() => applyPreset(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="mkt-range__field">
          <span>From</span>
          <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="mkt-range__field">
          <span>To</span>
          <input type="date" value={end} min={start} max={toISODate(new Date())} onChange={e => setEnd(e.target.value)} />
        </label>
      </div>

      <p className="owner-section__meta" style={{ marginTop: 4 }}>
        Attributing each booking to its {touchLabel} channel. Confirmed &amp; completed appointments only in the charts.
      </p>

      {chartError && <p className="owner-error">{chartError}</p>}

      {/* Time-series visualization */}
      <div className="owner-section">
        <div className="owner-section__header">
          <div>
            <h2 className="owner-section__title">Bookings Over Time by Source</h2>
            <p className="owner-section__meta">Daily {touchLabel} attribution across the selected range</p>
          </div>
          <div className="rev-range-toggle">
            {METRICS.map(m => (
              <button
                key={m.value}
                className={`cal-view-btn${metric === m.value ? ' cal-view-btn--active' : ''}`}
                onClick={() => setMetric(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {!series ? (
          <p className="owner-loading">Loading chart…</p>
        ) : chartRows.length === 0 ? (
          <p className="owner-empty">No appointment data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartRows} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} minTickGap={24} />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                allowDecimals={false}
                tickFormatter={v => (metric === 'total_cents' ? `$${v}` : v)}
              />
              <Tooltip
                formatter={(v, name) => [metric === 'total_cents' ? dollars(v * 100) : v, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {chartKeys.map((k, i) => (
                <Bar key={k} dataKey={k} stackId="s" fill={PALETTE[i % PALETTE.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Filterable, infinite-scrolling appointment list */}
      <div className="owner-section">
        <div className="owner-section__header">
          <div>
            <h2 className="owner-section__title">Attributed Appointments</h2>
            <p className="owner-section__meta">
              Every booking in range, attributed by {touchLabel} channel
            </p>
          </div>
        </div>

        <div className="mkt-filters">
          <label className="mkt-filters__field">
            <span>Source</span>
            <select value={source} onChange={e => setSource(e.target.value)}>
              <option value="">All sources</option>
              {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="mkt-filters__field">
            <span>Medium</span>
            <select value={medium} onChange={e => setMedium(e.target.value)}>
              <option value="">All mediums</option>
              {mediumOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="mkt-filters__field">
            <span>Campaign</span>
            <select value={campaign} onChange={e => setCampaign(e.target.value)}>
              <option value="">All campaigns</option>
              {campaignOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="mkt-filters__field">
            <span>Status</span>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Service</th>
                <th>Therapist</th>
                <th>Source</th>
                <th>Medium</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.scheduled_at)}</td>
                  <td>{a.client_name || '—'}</td>
                  <td>{a.service_name}</td>
                  <td>{a.therapist_first_name} {a.therapist_last_name}</td>
                  <td>{a[`${touch}_utm_source`] || 'Direct / Organic'}</td>
                  <td>{a[`${touch}_utm_medium`] || '—'}</td>
                  <td>{a[`${touch}_utm_campaign`] || '—'}</td>
                  <td><span className={`mkt-status mkt-status--${a.status}`}>{a.status}</span></td>
                  <td>{dollars(a.price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && !listLoading && !listError && (
          <p className="owner-empty">No appointments match these filters.</p>
        )}
        {listError && <p className="owner-error">{listError}</p>}
        {listLoading && <p className="owner-loading">Loading appointments…</p>}

        {/* Infinite-scroll sentinel */}
        <div ref={sentinelRef} className="mkt-sentinel" aria-hidden="true" />
        {!hasMoreRef.current && items.length > 0 && (
          <p className="owner-section__meta mkt-end" style={{ textAlign: 'center' }}>
            End of results — {items.length} appointment{items.length === 1 ? '' : 's'}.
          </p>
        )}
      </div>
    </div>
  );
}
