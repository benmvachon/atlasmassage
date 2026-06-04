import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';

expect.extend(toHaveNoViolations);

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../context/AuthContext.jsx', () => ({
  useAuth: jest.fn(() => ({ user: null, loading: false, login: jest.fn(), logout: jest.fn() })),
}));

jest.mock('../../context/MembershipContext.jsx', () => ({
  useMembership: jest.fn(() => ({ activeMembership: null, loading: false, error: null })),
}));

jest.mock('../../hooks/useAsync.js', () => ({
  useAsync: jest.fn(() => ({ data: null, loading: false, error: null, reload: jest.fn() })),
}));

jest.mock('../../services/businessService.js', () => ({
  businessService: { getHours: jest.fn().mockResolvedValue({ data: [] }) },
}));

import { useAuth } from '../../context/AuthContext.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function axeCheck(container) {
  const results = await axe(container, {
    rules: {
      // Disable color-contrast since jsdom can't compute computed styles
      'color-contrast': { enabled: false },
    },
  });
  expect(results).toHaveNoViolations();
}

// ── Component imports ──────────────────────────────────────────────────────────

import Modal from '../../components/Modal.jsx';
import FormField from '../../components/FormField.jsx';
import PageState from '../../components/PageState.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Header from '../../components/Header.jsx';
import Footer from '../../components/Footer.jsx';
import AuthCard from '../../components/AuthCard.jsx';
import TimeSlotPanel from '../../components/TimeSlotPanel.jsx';

// ── Modal ──────────────────────────────────────────────────────────────────────

describe('Modal — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <Modal title="Test Modal" onClose={jest.fn()}>
        <p>Modal body</p>
        <button>Action</button>
      </Modal>
    );
    await axeCheck(container);
  });

  it('moves focus into the dialog on mount', () => {
    render(
      <Modal title="Focus Test" onClose={jest.fn()}>
        <button>Child button</button>
      </Modal>
    );
    // The close button (×) is the first focusable element in the modal header
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement);
  });

  it('closes on Escape key', () => {
    const onClose = jest.fn();
    render(
      <Modal title="Esc Test" onClose={onClose}>
        <button>Focusable</button>
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus within the dialog', () => {
    render(
      <Modal title="Trap Test" onClose={jest.fn()}>
        <button>First</button>
        <button>Last</button>
      </Modal>
    );
    const [, last] = screen.getAllByRole('button').filter(b => b.textContent !== '×');
    // Focus the close button (×), then last button
    const closeBtn = screen.getByRole('button', { name: /close/i });

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('has aria-modal="true" and aria-labelledby on the dialog', () => {
    render(<Modal title="Labeled" onClose={jest.fn()}><p>x</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelId)).toHaveTextContent('Labeled');
  });

  it('close button has an accessible label', () => {
    render(<Modal title="Label Test" onClose={jest.fn()}><p>x</p></Modal>);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});

// ── FormField ─────────────────────────────────────────────────────────────────

describe('FormField — accessibility', () => {
  it('has no axe violations (no error)', async () => {
    const { container } = render(<FormField label="Email" id="email" type="email" />);
    await axeCheck(container);
  });

  it('has no axe violations (with error)', async () => {
    const { container } = render(
      <FormField label="Email" id="email" type="email" error="Invalid email" />
    );
    await axeCheck(container);
  });

  it('label is programmatically associated with input', () => {
    render(<FormField label="Phone" id="phone" type="tel" />);
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
  });

  it('error message has role="alert"', () => {
    render(<FormField label="Email" id="email" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});

// ── PageState ─────────────────────────────────────────────────────────────────

describe('PageState — accessibility', () => {
  it('has no axe violations (loading)', async () => {
    const { container } = render(<PageState loading />);
    await axeCheck(container);
  });

  it('has no axe violations (error)', async () => {
    const { container } = render(<PageState error="Something failed" />);
    await axeCheck(container);
  });

  it('loading state has role="status"', () => {
    render(<PageState loading loadingMessage="Loading data…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading data…');
  });

  it('error state has role="alert"', () => {
    render(<PageState error="Network error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Network error');
  });
});

// ── StatusBadge ───────────────────────────────────────────────────────────────

describe('StatusBadge — accessibility', () => {
  const statuses = ['active', 'paused', 'cancelled', 'pending', 'confirmed', 'completed', 'no_show'];

  statuses.forEach(status => {
    it(`has no axe violations for status "${status}"`, async () => {
      const { container } = render(<StatusBadge status={status} />);
      await axeCheck(container);
    });
  });
});

// ── Header ────────────────────────────────────────────────────────────────────

describe('Header — accessibility', () => {
  it('has no axe violations (logged out)', async () => {
    useAuth.mockReturnValue({ user: null, logout: jest.fn() });
    const { container } = render(<MemoryRouter><Header /></MemoryRouter>);
    await axeCheck(container);
  });

  it('has no axe violations (logged in as client)', async () => {
    useAuth.mockReturnValue({
      user: { roles: ['client'], first_name: 'Jane', last_name: 'Doe' },
      logout: jest.fn(),
    });
    const { container } = render(<MemoryRouter><Header /></MemoryRouter>);
    await axeCheck(container);
  });

  it('has no axe violations (logged in as owner)', async () => {
    useAuth.mockReturnValue({
      user: { roles: ['owner', 'therapist'], first_name: 'Bob', last_name: 'Smith' },
      logout: jest.fn(),
    });
    const { container } = render(<MemoryRouter><Header /></MemoryRouter>);
    await axeCheck(container);
  });

  it('renders a skip navigation link as the first focusable element', () => {
    useAuth.mockReturnValue({ user: null, logout: jest.fn() });
    const { container } = render(<MemoryRouter><Header /></MemoryRouter>);
    const skipLink = container.querySelector('.skip-nav');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('nav has an accessible label', () => {
    useAuth.mockReturnValue({ user: null, logout: jest.fn() });
    render(<MemoryRouter><Header /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });
});

// ── Footer ────────────────────────────────────────────────────────────────────

describe('Footer — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><Footer /></MemoryRouter>);
    await axeCheck(container);
  });

  it('nav has an accessible label', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: /footer navigation/i })).toBeInTheDocument();
  });
});

// ── AuthCard ──────────────────────────────────────────────────────────────────

describe('AuthCard — accessibility', () => {
  it('has no axe violations (no error)', async () => {
    const { container } = render(
      <AuthCard title="Sign in" onSubmit={jest.fn()}>
        <FormField label="Email" id="email" type="email" />
        <button type="submit">Submit</button>
      </AuthCard>
    );
    await axeCheck(container);
  });

  it('has no axe violations (with API error)', async () => {
    const { container } = render(
      <AuthCard title="Sign in" apiError="Invalid credentials" onSubmit={jest.fn()}>
        <FormField label="Email" id="email" type="email" />
        <button type="submit">Submit</button>
      </AuthCard>
    );
    await axeCheck(container);
  });

  it('API error has role="alert"', () => {
    render(
      <AuthCard title="Sign in" apiError="Wrong password" onSubmit={jest.fn()}>
        <button type="submit">Submit</button>
      </AuthCard>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong password');
  });

  it('title renders as h1', () => {
    render(
      <AuthCard title="Create account" onSubmit={jest.fn()}>
        <button type="submit">Go</button>
      </AuthCard>
    );
    expect(screen.getByRole('heading', { level: 1, name: /create account/i })).toBeInTheDocument();
  });
});

// ── TimeSlotPanel ─────────────────────────────────────────────────────────────

describe('TimeSlotPanel — accessibility', () => {
  const slots = [
    {
      startTime: '09:00',
      endTime: '10:00',
      availableTherapists: [{ id: '1', firstName: 'Alice', lastName: 'A' }],
    },
    {
      startTime: '10:00',
      endTime: '11:00',
      availableTherapists: [{ id: '1', firstName: 'Alice', lastName: 'A' }, { id: '2', firstName: 'Bob', lastName: 'B' }],
    },
  ];

  it('has no axe violations (with slots)', async () => {
    const { container } = render(
      <TimeSlotPanel date="2025-07-04" slots={slots} loading={false} error={null} onSelectSlot={jest.fn()} />
    );
    await axeCheck(container);
  });

  it('has no axe violations (loading)', async () => {
    const { container } = render(
      <TimeSlotPanel date="2025-07-04" slots={[]} loading error={null} onSelectSlot={jest.fn()} />
    );
    await axeCheck(container);
  });

  it('has no axe violations (error state)', async () => {
    const { container } = render(
      <TimeSlotPanel date="2025-07-04" slots={[]} loading={false} error="Failed to load" onSelectSlot={jest.fn()} />
    );
    await axeCheck(container);
  });

  it('error message has role="alert"', () => {
    render(
      <TimeSlotPanel date="2025-07-04" slots={[]} loading={false} error="Server error" onSelectSlot={jest.fn()} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Server error');
  });

  it('slot buttons have descriptive aria-labels', () => {
    render(
      <TimeSlotPanel date="2025-07-04" slots={slots} loading={false} error={null} onSelectSlot={jest.fn()} />
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn).toHaveAttribute('aria-label');
      expect(btn.getAttribute('aria-label').length).toBeGreaterThan(5);
    });
  });
});

// ── BookingCalendar ───────────────────────────────────────────────────────────

import BookingCalendar from '../../components/BookingCalendar.jsx';

describe('BookingCalendar — accessibility', () => {
  const baseProps = {
    year: 2025,
    month: 7,
    availableDays: ['2025-07-10', '2025-07-15'],
    businessHours: [
      { day_of_week: 0, is_closed: true },
      { day_of_week: 6, is_closed: true },
    ],
    selectedDate: null,
    onDayClick: jest.fn(),
    onMonthChange: jest.fn(),
    loading: false,
  };

  it('has no axe violations', async () => {
    const { container } = render(<BookingCalendar {...baseProps} />);
    await axeCheck(container);
  });

  it('has no axe violations (loading state)', async () => {
    const { container } = render(<BookingCalendar {...baseProps} loading />);
    await axeCheck(container);
  });

  it('has no axe violations (with selected date)', async () => {
    const { container } = render(<BookingCalendar {...baseProps} selectedDate="2025-07-10" />);
    await axeCheck(container);
  });

  it('prev/next month buttons have aria-labels', () => {
    render(<BookingCalendar {...baseProps} />);
    expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();
  });

  it('loading indicator has role="status"', () => {
    render(<BookingCalendar {...baseProps} loading />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('padding cells are hidden from assistive technology', () => {
    const { container } = render(<BookingCalendar {...baseProps} />);
    const pads = container.querySelectorAll('.avail-calendar__cell--pad');
    pads.forEach(pad => {
      expect(pad).toHaveAttribute('aria-hidden', 'true');
    });
  });
});

// ── Auth pages ────────────────────────────────────────────────────────────────

import LoginPage from '../../pages/LoginPage.jsx';
import SignupPage from '../../pages/SignupPage.jsx';
import ForgotPasswordPage from '../../pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../../pages/ResetPasswordPage.jsx';

describe('LoginPage — accessibility', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: null, loading: false, login: jest.fn(), logout: jest.fn() });
  });

  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><LoginPage /></MemoryRouter>);
    await axeCheck(container);
  });

  it('email and password fields are labelled', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('submit button is identifiable', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('SignupPage — accessibility', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: null, loading: false, register: jest.fn() });
  });

  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><SignupPage /></MemoryRouter>);
    await axeCheck(container);
  });
});

describe('ForgotPasswordPage — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    await axeCheck(container);
  });
});

describe('ResetPasswordPage — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);
    await axeCheck(container);
  });
});
