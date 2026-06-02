import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

jest.mock('../../context/AuthContext.jsx', () => ({ useAuth: jest.fn() }));

const mockLogin = jest.fn();

function renderPage(authOverrides = {}) {
  useAuth.mockReturnValue({ user: null, loading: false, login: mockLogin, ...authOverrides });
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

function fill(field, value) {
  fireEvent.change(screen.getByLabelText(field), { target: { value } });
}

beforeEach(() => { jest.clearAllMocks(); });

describe('LoginPage — rendering', () => {
  it('renders email and password fields and a sign-in button', () => {
    renderPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows a "Forgot password?" link', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('shows a link to create an account', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument();
  });
});

describe('LoginPage — client-side validation', () => {
  it('shows an error when email is empty on submit', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    // Both email and password errors appear — query by text content
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows an error when email is malformed', () => {
    renderPage();
    fill(/email address/i, 'notanemail');
    fill(/password/i, 'Password1');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('shows an error when password is empty on submit', () => {
    renderPage();
    fill(/email address/i, 'user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/password is required/i);
  });

  it('clears the email field error when the user starts typing again', () => {
    renderPage();
    // Submit with only the email field touched to produce exactly one error
    fill(/email address/i, 'bad');
    fill(/password/i, 'pass');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fill(/email address/i, 'user@example.com');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('LoginPage — form submission', () => {
  it('calls login() with email and password on valid submit', async () => {
    mockLogin.mockResolvedValue({ id: '1', roles: ['client'] });
    renderPage();
    fill(/email address/i, 'user@example.com');
    fill(/password/i, 'Password1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });
    expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'Password1' });
  });

  it('disables the button and shows "Signing in…" while submitting', async () => {
    let resolve;
    mockLogin.mockReturnValue(new Promise(r => { resolve = r; }));
    renderPage();
    fill(/email address/i, 'user@example.com');
    fill(/password/i, 'Password1');
    act(() => { fireEvent.click(screen.getByRole('button', { name: /sign in/i })); });
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    await act(async () => { resolve({ id: '1', roles: [] }); });
  });

  it('shows an API error message when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    renderPage();
    fill(/email address/i, 'user@example.com');
    fill(/password/i, 'wrongpass');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    );
  });

  it('re-enables the button after a failed login', async () => {
    mockLogin.mockRejectedValue(new Error('Fail'));
    renderPage();
    fill(/email address/i, 'user@example.com');
    fill(/password/i, 'Password1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });
});
