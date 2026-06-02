import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordPage from '../../pages/ForgotPasswordPage.jsx';
import { authService } from '../../services/authService.js';

jest.mock('../../services/authService.js', () => ({
  authService: { forgotPassword: jest.fn() },
}));

function renderPage() {
  return render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
}

beforeEach(() => { jest.clearAllMocks(); });

describe('ForgotPasswordPage — rendering', () => {
  it('renders an email field and a submit button', () => {
    renderPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows a link back to sign in', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage — validation', () => {
  it('shows a field error when email is empty', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('shows a field error when email is malformed', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'bademail' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });
});

describe('ForgotPasswordPage — submission', () => {
  it('calls authService.forgotPassword with the entered email', async () => {
    authService.forgotPassword.mockResolvedValue();
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    });
    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('shows the success state after a successful submission', async () => {
    authService.forgotPassword.mockResolvedValue();
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
  });

  it('shows an API error when forgotPassword fails', async () => {
    authService.forgotPassword.mockRejectedValue(new Error('Server error'));
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    );
  });

  it('disables the button while submitting', () => {
    let resolve;
    authService.forgotPassword.mockReturnValue(new Promise(r => { resolve = r; }));
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'user@example.com' } });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /send reset link/i })); });
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
    // cleanup dangling promise
    act(() => { resolve(); });
  });
});
