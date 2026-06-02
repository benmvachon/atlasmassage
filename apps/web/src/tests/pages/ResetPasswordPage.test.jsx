import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResetPasswordPage from '../../pages/ResetPasswordPage.jsx';
import { authService } from '../../services/authService.js';

jest.mock('../../services/authService.js', () => ({
  authService: { resetPassword: jest.fn() },
}));

function renderWithToken(token) {
  const path = token ? `/reset-password?token=${token}` : '/reset-password';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { jest.clearAllMocks(); });

describe('ResetPasswordPage — no token', () => {
  it('shows an "Invalid reset link" message when the token is absent', () => {
    renderWithToken(null);
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^new password$/i)).toBeNull();
  });

  it('shows a link to request a new reset link', () => {
    renderWithToken(null);
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });
});

describe('ResetPasswordPage — with token', () => {
  it('renders the new password and confirm password fields', () => {
    renderWithToken('abc123');
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });
});

describe('ResetPasswordPage — validation', () => {
  it('shows an error when password is shorter than 8 characters', () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    // The role="alert" span (form field error) is more specific than the subtitle paragraph
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('shows an error when passwords do not match', () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'Password1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'Password2' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });
});

describe('ResetPasswordPage — submission', () => {
  it('calls authService.resetPassword with the token and new password', async () => {
    authService.resetPassword.mockResolvedValue();
    renderWithToken('abc123');
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'NewPassword1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'NewPassword1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });
    expect(authService.resetPassword).toHaveBeenCalledWith({ token: 'abc123', password: 'NewPassword1' });
  });

  it('shows the success state after a valid reset', async () => {
    authService.resetPassword.mockResolvedValue();
    renderWithToken('abc123');
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'NewPassword1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'NewPassword1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });
    await waitFor(() =>
      expect(screen.getByText(/password updated/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /update/i })).toBeNull();
  });

  it('shows an API error when resetPassword fails', async () => {
    authService.resetPassword.mockRejectedValue(new Error('Token expired'));
    renderWithToken('abc123');
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'NewPassword1' } });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'NewPassword1' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Token expired')
    );
  });
});
