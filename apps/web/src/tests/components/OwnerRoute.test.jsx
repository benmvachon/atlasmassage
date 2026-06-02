import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OwnerRoute from '../../components/OwnerRoute.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

jest.mock('../../context/AuthContext.jsx', () => ({ useAuth: jest.fn() }));

const OWNER_USER  = { id: '1', email: 'owner@example.com', roles: ['owner'] };
const CLIENT_USER = { id: '2', email: 'client@example.com', roles: ['client'] };

function wrap(authValue) {
  useAuth.mockReturnValue(authValue);
  return render(
    <MemoryRouter initialEntries={['/owner']}>
      <Routes>
        <Route
          path="/owner"
          element={
            <OwnerRoute>
              <div>Owner Content</div>
            </OwnerRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/"     element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('OwnerRoute', () => {
  it('renders children for a user with the owner role', () => {
    wrap({ user: OWNER_USER, loading: false });
    expect(screen.getByText('Owner Content')).toBeInTheDocument();
  });

  it('redirects to /login when no user is authenticated', () => {
    wrap({ user: null, loading: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Owner Content')).toBeNull();
  });

  it('redirects to / for an authenticated non-owner user', () => {
    wrap({ user: CLIENT_USER, loading: false });
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Owner Content')).toBeNull();
  });

  it('renders nothing while the auth state is loading', () => {
    const { container } = wrap({ user: null, loading: true });
    expect(container).toBeEmptyDOMElement();
  });
});
