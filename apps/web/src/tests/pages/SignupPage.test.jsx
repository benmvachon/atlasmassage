import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../../pages/SignupPage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

jest.mock('../../context/AuthContext.jsx', () => ({ useAuth: jest.fn() }));

const mockRegister = jest.fn();

function renderPage() {
  useAuth.mockReturnValue({ user: null, loading: false, register: mockRegister });
  return render(<MemoryRouter><SignupPage /></MemoryRouter>);
}

function fill(labelRe, value) {
  fireEvent.change(screen.getByLabelText(labelRe), { target: { value } });
}

function fillValid(overrides = {}) {
  const v = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', password: 'Password1', ...overrides };
  if (v.firstName !== undefined) fill(/first name/i,    v.firstName);
  if (v.lastName  !== undefined) fill(/last name/i,     v.lastName);
  if (v.email     !== undefined) fill(/email address/i, v.email);
  if (v.password  !== undefined) fill(/password/i,      v.password);
}

beforeEach(() => { jest.clearAllMocks(); });

describe('SignupPage — rendering', () => {
  it('renders all four form fields', () => {
    renderPage();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows a link to the sign-in page', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('SignupPage — validation', () => {
  it('shows errors when required fields are empty on submit', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('shows an error when first name is missing', () => {
    renderPage();
    fillValid({ firstName: '' });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
  });

  it('shows an error for an invalid email', () => {
    renderPage();
    fillValid({ email: 'bademail' });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('shows an error when password is shorter than 8 characters', () => {
    renderPage();
    fillValid({ password: 'short' });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });
});

describe('SignupPage — submission', () => {
  it('calls register() with all field values on valid submit', async () => {
    mockRegister.mockResolvedValue({ id: '1', roles: ['client'] });
    renderPage();
    fillValid();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    });
    expect(mockRegister).toHaveBeenCalledWith({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', password: 'Password1',
    });
  });

  it('shows an API error when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('Email already in use'));
    renderPage();
    fillValid();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email already in use')
    );
  });

  it('disables the button while submitting', async () => {
    let resolve;
    mockRegister.mockReturnValue(new Promise(r => { resolve = r; }));
    renderPage();
    fillValid();
    act(() => { fireEvent.click(screen.getByRole('button', { name: /create account/i })); });
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    await act(async () => { resolve({ id: '1' }); });
  });
});
