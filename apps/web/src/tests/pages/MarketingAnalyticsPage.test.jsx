import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MarketingAnalyticsPage from '../../pages/owner/MarketingAnalyticsPage.jsx';
import { adminService } from '../../services/adminService.js';

// recharts needs a sized container that jsdom can't provide — stub it to passthroughs.
jest.mock('recharts', () => {
  const React = require('react');
  const Passthrough = ({ children }) => React.createElement('div', null, children);
  return {
    ResponsiveContainer: ({ children }) =>
      React.createElement('div', { 'data-testid': 'chart' }, children),
    BarChart: Passthrough,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

jest.mock('../../services/adminService.js', () => ({
  adminService: {
    getMarketingSources: jest.fn(),
    getAttributionTimeseries: jest.fn(),
    listAttributedAppointments: jest.fn(),
  },
}));

// Controllable IntersectionObserver so tests can simulate the sentinel scrolling into view.
let lastObserverCb = null;
beforeAll(() => {
  // eslint-disable-next-line no-undef
  global.IntersectionObserver = class {
    constructor(cb) { lastObserverCb = cb; }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

function triggerIntersect() {
  return act(async () => {
    lastObserverCb?.([{ isIntersecting: true }]);
  });
}

function makeAppt(overrides = {}) {
  return {
    id: 'appt-1',
    scheduled_at: '2030-06-15T10:00:00.000Z',
    status: 'completed',
    duration_minutes: 60,
    service_name: 'Deep Tissue',
    price_cents: 9000,
    client_name: 'Jordan Test',
    client_email: 'jordan@example.com',
    therapist_first_name: 'Alice',
    therapist_last_name: 'Smith',
    first_utm_source: 'google', first_utm_medium: 'cpc', first_utm_campaign: 'spring',
    last_utm_source: 'google', last_utm_medium: 'cpc', last_utm_campaign: 'spring',
    ...overrides,
  };
}

const SOURCES_RESPONSE = {
  data: {
    bySource: [{ source: 'google' }, { source: 'instagram' }],
    byCampaign: [
      { source: 'google', medium: 'cpc', campaign: 'spring' },
      { source: 'instagram', medium: 'social', campaign: null },
    ],
    summary: {},
  },
};

const TIMESERIES_RESPONSE = {
  data: {
    touch: 'first',
    series: [
      { date: '2030-06-14', source: 'google', appointment_count: 2, total_cents: 18000 },
      { date: '2030-06-15', source: 'instagram', appointment_count: 1, total_cents: 9000 },
    ],
  },
};

function listResponse(appointments, nextCursor = null) {
  return { data: { appointments, nextCursor } };
}

function renderPage() {
  return render(<MemoryRouter><MarketingAnalyticsPage /></MemoryRouter>);
}

beforeEach(() => {
  jest.clearAllMocks();
  lastObserverCb = null;
  adminService.getMarketingSources.mockResolvedValue(SOURCES_RESPONSE);
  adminService.getAttributionTimeseries.mockResolvedValue(TIMESERIES_RESPONSE);
  adminService.listAttributedAppointments.mockResolvedValue(
    listResponse([makeAppt()], null)
  );
});

describe('MarketingAnalyticsPage', () => {
  it('renders the title, chart, and the first page of attributed appointments', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Marketing Analytics' })).toBeInTheDocument();

    // First page of the list loads on mount.
    await waitFor(() => expect(screen.getByText('Jordan Test')).toBeInTheDocument());
    expect(screen.getByText('Deep Tissue')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('$90.00')).toBeInTheDocument();

    // Time-series visualization renders once series data arrives.
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });

  it('requests charts and list with a default 30-day range on mount', async () => {
    renderPage();
    await waitFor(() => expect(adminService.listAttributedAppointments).toHaveBeenCalled());

    const [start, end, touch] = adminService.getMarketingSources.mock.calls[0];
    const spanDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
    expect(spanDays).toBe(30);
    expect(touch).toBe('first');
  });

  it('loads the next page when the sentinel scrolls into view and then reports the end', async () => {
    adminService.listAttributedAppointments
      .mockResolvedValueOnce(listResponse([makeAppt({ id: 'a1', client_name: 'First Page' })], 'CURSOR1'))
      .mockResolvedValueOnce(listResponse([makeAppt({ id: 'a2', client_name: 'Second Page' })], null));

    renderPage();
    await waitFor(() => expect(screen.getByText('First Page')).toBeInTheDocument());

    await triggerIntersect();

    await waitFor(() => expect(screen.getByText('Second Page')).toBeInTheDocument());
    // First page rows remain — the list appends rather than replaces.
    expect(screen.getByText('First Page')).toBeInTheDocument();
    expect(adminService.listAttributedAppointments).toHaveBeenCalledTimes(2);

    // The second call carries the cursor returned by the first page.
    expect(adminService.listAttributedAppointments.mock.calls[1][0]).toMatchObject({ cursor: 'CURSOR1' });

    // Exhausted list shows the end-of-results marker.
    await waitFor(() => expect(screen.getByText(/End of results/)).toBeInTheDocument());
  });

  it('does not fetch past the last page on further scroll', async () => {
    // Default mock returns a single page with no cursor.
    renderPage();
    await waitFor(() => expect(adminService.listAttributedAppointments).toHaveBeenCalledTimes(1));

    await triggerIntersect();
    // No nextCursor → no additional fetch.
    expect(adminService.listAttributedAppointments).toHaveBeenCalledTimes(1);
  });

  it('refetches the list with the chosen source filter', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Jordan Test')).toBeInTheDocument());

    // combobox order: [0] Source, [1] Medium, [2] Campaign, [3] Status
    const sourceSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(sourceSelect, { target: { value: 'instagram' } });

    await waitFor(() =>
      expect(adminService.listAttributedAppointments).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'instagram', cursor: null })
      )
    );
  });

  it('refetches the list with the chosen status filter', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Jordan Test')).toBeInTheDocument());

    const statusSelect = screen.getAllByRole('combobox')[3];
    fireEvent.change(statusSelect, { target: { value: 'cancelled' } });

    await waitFor(() =>
      expect(adminService.listAttributedAppointments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'cancelled' })
      )
    );
  });

  it('switches to last-touch and refetches the charts', async () => {
    renderPage();
    await waitFor(() => expect(adminService.getMarketingSources).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Last-touch' }));

    await waitFor(() =>
      expect(adminService.getMarketingSources).toHaveBeenLastCalledWith(
        expect.any(String), expect.any(String), 'last'
      )
    );
    expect(adminService.getAttributionTimeseries).toHaveBeenLastCalledWith(
      expect.any(String), expect.any(String), 'last'
    );
  });

  it('changes the time range when a preset is chosen', async () => {
    renderPage();
    await waitFor(() => expect(adminService.getMarketingSources).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: '90 days' }));

    await waitFor(() => {
      const [start, end] = adminService.getMarketingSources.mock.calls.at(-1);
      const spanDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
      expect(spanDays).toBe(90);
    });
  });

  it('toggles the chart metric between appointments and revenue', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('chart')).toBeInTheDocument());

    const revenueBtn = screen.getByRole('button', { name: 'Revenue' });
    fireEvent.click(revenueBtn);
    expect(revenueBtn).toHaveClass('cal-view-btn--active');
  });

  it('shows an error when the analytics charts fail to load', async () => {
    adminService.getMarketingSources.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load analytics.')).toBeInTheDocument());
  });

  it('shows an error when the appointment list fails to load', async () => {
    adminService.listAttributedAppointments.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByText('Failed to load appointments.')).toBeInTheDocument());
  });

  it('shows an empty state when no appointments match the filters', async () => {
    adminService.listAttributedAppointments.mockResolvedValue(listResponse([], null));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('No appointments match these filters.')).toBeInTheDocument()
    );
  });
});
