import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppointmentsCalendarPage from '../../pages/owner/AppointmentsCalendarPage.jsx';
import { adminService } from '../../services/adminService.js';

jest.mock('../../services/adminService.js', () => ({
  adminService: {
    listAppointments: jest.fn(),
    updateAppointmentStatus: jest.fn(),
  },
}));

function makeAppt(overrides = {}) {
  return {
    id: 'appt-1',
    status: 'pending',
    scheduled_at: '2030-09-22T10:00:00Z',
    duration_minutes: 60,
    service_name: 'Deep Tissue',
    price_cents: 9000,
    therapist_id: 'th-1',
    therapist_first_name: 'Alice',
    therapist_last_name: 'Smith',
    client_name: 'Jordan Test',
    client_email: 'jordan@example.com',
    client_phone: null,
    guest_phone: null,
    bed_name: 'Table 2',
    consent_signed_at: null,
    notes: null,
    ...overrides,
  };
}

function renderPage() {
  return render(<MemoryRouter><AppointmentsCalendarPage /></MemoryRouter>);
}

async function openDetailModal(bedName) {
  adminService.listAppointments.mockResolvedValue({
    success: true,
    data: { appointments: [makeAppt({ bed_name: bedName })], therapists: [] },
  });
  renderPage();

  // Switch to List view so the Sep-2030 appointment is visible regardless of today's date
  await waitFor(() => expect(adminService.listAppointments).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'List' }));

  // Click the appointment card to open the detail modal
  await waitFor(() => screen.getByText('Jordan Test'));
  fireEvent.click(screen.getByRole('button', { name: /Jordan Test/i }));

  await waitFor(() => screen.getByRole('heading', { name: 'Deep Tissue' }));
}

beforeEach(() => jest.clearAllMocks());

describe('AppointmentsCalendarPage — Table row in appointment detail', () => {
  it('shows the assigned bed name in the appointment detail modal', async () => {
    await openDetailModal('Table 2');
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('Table 2')).toBeInTheDocument();
  });

  it('shows "—" in the Table row when no bed is assigned', async () => {
    await openDetailModal(null);

    // "Table" term is present
    expect(screen.getByText('Table')).toBeInTheDocument();

    // The definition next to it should be "—" (not a bed name)
    const dts = screen.getAllByRole('term');
    const tableDt = dts.find(dt => dt.textContent === 'Table');
    expect(tableDt).toBeDefined();
    // The sibling <dd> following the <dt>Table</dt> should contain "—"
    const tableDd = tableDt.nextElementSibling;
    expect(tableDd).toHaveTextContent('—');
  });
});
