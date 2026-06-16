import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import { businessService } from '../services/businessService';

jest.mock('../services/businessService', () => ({
  businessService: {
    getHours: jest.fn().mockResolvedValue({ data: [] }),
    getContactInfo: jest.fn().mockResolvedValue({ data: null }),
  },
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
