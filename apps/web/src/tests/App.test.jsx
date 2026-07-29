import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import { businessService } from '../services/businessService';

jest.mock('../services/businessService', () => ({
  businessService: {
    getHours: jest.fn().mockResolvedValue({ data: [] }),
    getContactInfo: jest.fn().mockResolvedValue({ data: null }),
    getTravelSettings: jest.fn().mockResolvedValue({ data: { travel_mode_enabled: false } }),
    getServiceArea: jest.fn().mockResolvedValue({ data: { towns: [], maxDriveMinutes: 20 } }),
  },
}));

jest.mock('../components/ServiceAreaMap', () => ({
  __esModule: true,
  default: () => <div data-testid="service-area-map" />,
}));

describe('HomePage', () => {
  it('renders the hero title', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
    });
    expect(screen.getByText('Therapeutic Bodywork')).toBeInTheDocument();
  });

  it('renders the Book Now CTA link', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
    });
    const link = screen.getByRole('link', { name: /book now/i });
    expect(link).toHaveAttribute('href', '/booking');
  });

  it('renders the configured address, phone, and email from businessService', async () => {
    businessService.getContactInfo.mockResolvedValueOnce({
      data: {
        address_line1: '456 Newbury St',
        address_line2: 'Suite 2',
        city: 'Boston',
        state: 'MA',
        zip: '02115',
        phone: '(617) 555-9999',
        email: 'contact@atlasmassage.com',
      },
    });
    await act(async () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
    });
    const addressItem = screen.getByText('Address').closest('li');
    expect(addressItem.textContent).toContain('456 Newbury St');
    expect(addressItem.textContent).toContain('Suite 2');
    expect(addressItem.textContent).toContain('Boston');
    expect(addressItem.textContent).toContain('MA');
    expect(addressItem.textContent).toContain('02115');
    const phoneLink = screen.getByRole('link', { name: '(617) 555-9999' });
    expect(phoneLink).toHaveAttribute('href', 'tel:+16175559999');
    const emailLink = screen.getByRole('link', { name: 'contact@atlasmassage.com' });
    expect(emailLink).toHaveAttribute('href', 'mailto:contact@atlasmassage.com');
  });

  it('shows a fallback message when contact info is unavailable', async () => {
    businessService.getContactInfo.mockResolvedValueOnce({ data: null });
    await act(async () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
    });
    expect(screen.getByText(/contact info is not available/i)).toBeInTheDocument();
  });

  it('shows the service area (not the street address) when travel mode is enabled', async () => {
    businessService.getContactInfo.mockResolvedValueOnce({
      data: {
        address_line1: '101 Bellevue Street', address_line2: '', city: 'Newton',
        state: 'MA', zip: '02458', phone: '(617) 555-9999', email: 'contact@atlasmassage.com',
      },
    });
    businessService.getTravelSettings.mockResolvedValueOnce({ data: { travel_mode_enabled: true } });
    businessService.getServiceArea.mockResolvedValueOnce({
      data: { towns: ['Brookline', 'Newton', 'Watertown'], maxDriveMinutes: 20 },
    });
    await act(async () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
    });
    // The real street address must not be exposed in travel mode.
    expect(screen.queryByText('Address')).not.toBeInTheDocument();
    expect(screen.queryByText(/101 Bellevue Street/)).not.toBeInTheDocument();
    // Instead we show a "we come to you" message and the served towns from the API.
    const areasItem = screen.getByText('Areas').closest('li');
    expect(areasItem.textContent).toMatch(/come to you/i);
    expect(areasItem.textContent).toContain('Newton');
    expect(areasItem.textContent).toContain('Brookline');
    expect(screen.getByTestId('service-area-map')).toBeInTheDocument();
  });
});

describe('NotFoundPage', () => {
  it('renders 404 message', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });
});
