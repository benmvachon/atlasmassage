import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';

describe('HomePage', () => {
  it('renders the hero title', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByText('Restore. Renew. Relax.')).toBeInTheDocument();
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
