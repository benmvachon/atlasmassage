import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';

jest.mock('../services/businessService', () => ({
  businessService: {
    getHours: jest.fn().mockResolvedValue({ data: [] }),
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
