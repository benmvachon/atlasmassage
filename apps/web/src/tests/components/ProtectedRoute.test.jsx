import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

jest.mock('../../context/AuthContext.jsx', () => ({ useAuth: jest.fn() }));

const MOCK_USER = { id: '1', email: 'user@example.com', roles: ['client'] };

function wrap(authValue) {
  useAuth.mockReturnValue(authValue);
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('renders children when the user is authenticated', () => {
    wrap({ user: MOCK_USER, loading: false });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when user is null and not loading', () => {
    wrap({ user: null, loading: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('renders nothing while the auth state is loading', () => {
    const { container } = wrap({ user: null, loading: true });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while loading even when a user is present', () => {
    const { container } = wrap({ user: MOCK_USER, loading: true });
    expect(container).toBeEmptyDOMElement();
  });
});
