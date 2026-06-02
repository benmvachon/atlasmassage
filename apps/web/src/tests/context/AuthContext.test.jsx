import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../context/AuthContext.jsx';
import { authService } from '../../services/authService.js';
import { userService } from '../../services/userService.js';
import { setAccessToken } from '../../services/api.js';

jest.mock('../../services/authService.js', () => ({
  authService: {
    refresh:        jest.fn(),
    login:          jest.fn(),
    register:       jest.fn(),
    logout:         jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword:  jest.fn(),
  },
}));

jest.mock('../../services/userService.js', () => ({
  userService: { getMe: jest.fn() },
}));

jest.mock('../../services/api.js', () => ({
  setAccessToken: jest.fn(),
  api: {},
}));

const MOCK_USER  = { id: 'u1', email: 'jane@example.com', roles: ['client'] };
const MOCK_TOKEN = 'access-token-abc';

function Consumer() {
  const { user, loading, login, register, logout, refreshUser } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user?.email ?? 'none'}</div>
      <button onClick={() => login({ email: 'jane@example.com', password: 'pass' })}>Login</button>
      <button onClick={() => register({ email: 'new@example.com', password: 'pass' })}>Register</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => refreshUser()}>Refresh User</button>
    </div>
  );
}

function wrap() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => { jest.clearAllMocks(); });

describe('AuthProvider — session restoration', () => {
  it('calls authService.refresh on mount and populates user on success', async () => {
    authService.refresh.mockResolvedValue({ user: MOCK_USER, accessToken: MOCK_TOKEN });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com');
    expect(setAccessToken).toHaveBeenCalledWith(MOCK_TOKEN);
  });

  it('clears session and sets loading=false when refresh fails', async () => {
    authService.refresh.mockRejectedValue(new Error('No session'));
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(setAccessToken).toHaveBeenCalledWith(null);
  });
});

describe('AuthProvider — login', () => {
  it('calls authService.login and sets the user in context', async () => {
    authService.refresh.mockRejectedValue(new Error());
    authService.login.mockResolvedValue({ user: MOCK_USER, accessToken: MOCK_TOKEN });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com');
    expect(authService.login).toHaveBeenCalledWith({ email: 'jane@example.com', password: 'pass' });
  });
});

describe('AuthProvider — register', () => {
  it('calls authService.register and sets the user in context', async () => {
    authService.refresh.mockRejectedValue(new Error());
    authService.register.mockResolvedValue({ user: MOCK_USER, accessToken: MOCK_TOKEN });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com');
  });
});

describe('AuthProvider — logout', () => {
  it('calls authService.logout and clears user from context', async () => {
    authService.refresh.mockResolvedValue({ user: MOCK_USER, accessToken: MOCK_TOKEN });
    authService.logout.mockResolvedValue();
    wrap();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(setAccessToken).toHaveBeenLastCalledWith(null);
  });

  it('clears session even if authService.logout throws', async () => {
    authService.refresh.mockResolvedValue({ user: MOCK_USER, accessToken: MOCK_TOKEN });
    authService.logout.mockRejectedValue(new Error('network error'));
    wrap();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });
});

describe('AuthProvider — refreshUser', () => {
  it('fetches current user and updates context', async () => {
    authService.refresh.mockRejectedValue(new Error());
    userService.getMe.mockResolvedValue({ data: { user: MOCK_USER } });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh User' }));
    });
    expect(screen.getByTestId('user')).toHaveTextContent('jane@example.com');
    expect(userService.getMe).toHaveBeenCalled();
  });
});

describe('useAuth — guard', () => {
  it('throws when used outside of AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useAuth must be used within <AuthProvider>');
    spy.mockRestore();
  });
});
