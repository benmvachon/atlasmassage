import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import BookingModal from '../../components/BookingModal.jsx';
import { bookingService } from '../../services/bookingService.js';

// ── Stripe mocks ──────────────────────────────────────────────────────────────

const mockStripe = {
  createPaymentMethod: jest.fn(),
  confirmCardPayment: jest.fn(),
};
const mockCardElement = { _mock: 'card-element' };
const mockElements = { getElement: jest.fn(() => mockCardElement) };

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: jest.fn(),
  useElements: jest.fn(),
}));

jest.mock('../../services/stripe.js', () => ({
  getStripePromise: () => null,
  stripePublishableKey: 'pk_test_fake',
}));

jest.mock('../../services/bookingService.js', () => ({
  bookingService: {
    createAppointment: jest.fn(),
    confirmAppointment: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../services/paymentService.js', () => ({
  paymentService: {
    listPaymentMethods: jest.fn().mockResolvedValue({ data: { methods: [] } }),
  },
}));

jest.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: null }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SLOT = {
  startTime: '10:00',
  endTime: '11:00',
  availableTherapists: [{ id: 'tid-1', firstName: 'Alice', lastName: 'Smith' }],
};
const SERVICES = [{ id: 'sid-1', name: 'Massage', priceCents: 10000 }];
const APPT    = { id: 'appt-1', client_id: null };

function renderModal(overrides = {}) {
  return render(
    <BookingModal
      slot={SLOT}
      date="2030-06-15"
      services={SERVICES}
      lockedTherapist={null}
      onClose={jest.fn()}
      onComplete={jest.fn()}
      {...overrides}
    />
  );
}

function fill(labelMatcher, value) {
  fireEvent.change(screen.getByLabelText(labelMatcher), { target: { value } });
}

// ── Canvas API stubs (jsdom has no 2D context) ────────────────────────────────

const mockCtx = {
  scale: jest.fn(), beginPath: jest.fn(), moveTo: jest.fn(),
  lineTo: jest.fn(), stroke: jest.fn(), clearRect: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useStripe.mockReturnValue(mockStripe);
  useElements.mockReturnValue(mockElements);
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
  HTMLCanvasElement.prototype.toDataURL  = jest.fn(() => 'data:image/png;base64,sig');
});

// ── Continue button disabled state ────────────────────────────────────────────

describe('BookingModal — continue button disabled state', () => {
  it('is disabled before the guest fills in required fields', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('remains disabled with name filled but email empty', () => {
    renderModal();
    fill(/full name/i, 'Jane Doe');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('remains disabled with an invalid email', () => {
    renderModal();
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'notanemail');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('becomes enabled once name and a valid email are provided', () => {
    renderModal();
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'jane@example.com');
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
  });
});

// ── New-card guest booking — integration ──────────────────────────────────────

describe('BookingModal — new-card guest booking', () => {
  beforeEach(() => {
    mockStripe.createPaymentMethod.mockResolvedValue({
      paymentMethod: { id: 'pm_test_123' },
      error: null,
    });
    mockStripe.confirmCardPayment.mockResolvedValue({ error: null });
    bookingService.createAppointment.mockResolvedValue({
      appointment: APPT,
      clientSecret: 'cs_test_secret',
    });
  });

  async function advanceToWaiverStep() {
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'jane@example.com');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });
  }

  it('tokenizes the card on Continue before unmounting the CardElement', async () => {
    renderModal();
    await advanceToWaiverStep();

    expect(mockStripe.createPaymentMethod).toHaveBeenCalledWith({
      type: 'card',
      card: mockCardElement,
    });
    expect(screen.getByText(/massage therapy consent/i)).toBeInTheDocument();
  });

  it('confirms payment with the staged PM id (not the card element) on Sign & Book', async () => {
    renderModal();
    await advanceToWaiverStep();

    // Draw on the signature canvas to produce a non-empty signature
    const canvas = document.querySelector('canvas');
    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);

    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign & book/i }));
    });

    expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith(
      'cs_test_secret',
      { payment_method: 'pm_test_123' }
    );
  });

  it('shows the success screen after a completed booking', async () => {
    renderModal();
    await advanceToWaiverStep();

    const canvas = document.querySelector('canvas');
    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);
    fireEvent.click(screen.getByRole('checkbox'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign & book/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
    });
  });

  it('shows a card error and stays on the form when tokenization fails', async () => {
    mockStripe.createPaymentMethod.mockResolvedValue({
      paymentMethod: null,
      error: { message: 'Your card number is incomplete.' },
    });

    renderModal();
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'jane@example.com');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });

    expect(screen.getByText(/your card number is incomplete/i)).toBeInTheDocument();
    expect(screen.queryByText(/massage therapy consent/i)).not.toBeInTheDocument();
  });
});
