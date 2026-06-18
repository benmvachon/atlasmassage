import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TherapistBookingsPage from '../../pages/therapist/TherapistBookingsPage.jsx';
import { api } from '../../services/api.js';

jest.mock('../../services/api.js', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'therapist-1', roles: ['therapist'] } }),
}));

function makeAppt(overrides = {}) {
  return {
    id: 'appt-1',
    status: 'confirmed',
    scheduled_at: '2030-09-22T10:00:00Z',
    duration_minutes: 60,
    service_name: 'Deep Tissue',
    price_cents: 9000,
    client_name: 'Jordan Test',
    client_email: 'jordan@example.com',
    client_phone: null,
    bed_name: 'Table 2',
    consent_signed_at: '2030-01-01T00:00:00Z',
    transfer_request_id: null,
    has_soap_notes: false,
    ...overrides,
  };
}

function renderPage() {
  return render(<MemoryRouter><TherapistBookingsPage /></MemoryRouter>);
}

beforeEach(() => jest.clearAllMocks());

describe('TherapistBookingsPage — Table column', () => {
  it('renders the Table column header when appointments are present', async () => {
    api.get.mockResolvedValue({ success: true, data: [makeAppt()] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: 'Table' })).toBeInTheDocument()
    );
  });

  it('shows the assigned bed name for an appointment', async () => {
    api.get.mockResolvedValue({ success: true, data: [makeAppt({ bed_name: 'Table 2' })] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Table 2')).toBeInTheDocument());
  });

  it('shows "—" in the table cell when no bed is assigned', async () => {
    api.get.mockResolvedValue({ success: true, data: [makeAppt({ bed_name: null })] });
    renderPage();
    await waitFor(() => screen.getByText('Jordan Test')); // row is rendered

    // bed_name cell renders '—' (the table still renders; check no table label text appears)
    expect(screen.queryByText(/^Table \d$/)).not.toBeInTheDocument();

    // The cell itself contains the em-dash placeholder
    const cells = screen.getAllByRole('cell');
    const bedCell = cells[4]; // 0:datetime, 1:client, 2:service, 3:duration, 4:bed
    expect(bedCell).toHaveTextContent('—');
  });
});
