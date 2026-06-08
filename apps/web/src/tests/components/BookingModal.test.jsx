import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import BookingModal from '../../components/BookingModal.jsx';
import { bookingService } from '../../services/bookingService.js';

// ── Stripe mocks ──────────────────────────────────────────────────────────────

const mockStripe = {
  createPaymentMethod: jest.fn(),
  confirmCardPayment:  jest.fn(),
};
const mockCardElement = { _mock: 'card-element' };
const mockElements    = { getElement: jest.fn(() => mockCardElement) };

jest.mock('@stripe/react-stripe-js', () => ({
  Elements:    ({ children }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe:   jest.fn(),
  useElements: jest.fn(),
}));

jest.mock('../../services/stripe.js', () => ({
  getStripePromise:      () => null,
  stripePublishableKey:  'pk_test_fake',
}));

jest.mock('../../services/bookingService.js', () => ({
  bookingService: {
    createAppointment:  jest.fn(),
    confirmAppointment: jest.fn().mockResolvedValue({}),
    getConsentStatus:   jest.fn().mockResolvedValue({ data: { hasSigned: false, signedAt: null } }),
    getHealthStatus:    jest.fn().mockResolvedValue({ data: { hasRecord: false } }),
  },
}));

jest.mock('../../services/paymentService.js', () => ({
  paymentService: {
    listPaymentMethods: jest.fn().mockResolvedValue({ data: { methods: [] } }),
  },
}));

jest.mock('../../services/membershipService.js', () => ({
  membershipService: {
    getMyStatus: jest.fn().mockResolvedValue({ data: { active: false } }),
  },
}));

jest.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: null }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SLOT = {
  startTime: '10:00',
  endTime:   '11:00',
  availableTherapists: [{ id: 'tid-1', firstName: 'Alice', lastName: 'Smith' }],
};
const SERVICES = [{ id: 'sid-1', name: 'Massage', priceCents: 10000 }];
const APPT     = { id: 'appt-1', client_id: null };

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

  bookingService.createAppointment.mockResolvedValue({
    appointment: APPT,
    clientSecret: 'cs_test_secret',
  });
  mockStripe.createPaymentMethod.mockResolvedValue({
    paymentMethod: { id: 'pm_test_123' },
    error: null,
  });
  mockStripe.confirmCardPayment.mockResolvedValue({ error: null });
});

// ── Navigation helpers ────────────────────────────────────────────────────────

/** Fill all required contact fields on the contact step. */
function fillContactFields() {
  fill(/full name/i,     'Jane Doe');
  fill(/email/i,         'jane@example.com');
  fill(/street address/i,'123 Test St');
  fill(/city/i,          'Test City');
  fill(/state/i,         'CA');
  fill(/zip code/i,      '12345');
}

/** Advance from the contact step to the health step. */
async function advanceToHealth() {
  fillContactFields();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  });
}

/** Advance from the health step to the consent step. */
async function advanceToConsent() {
  await advanceToHealth();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  });
}

/** Draw a signature on the canvas and check the agreement checkbox, then advance. */
async function advanceToPayment() {
  await advanceToConsent();
  // The canvas is now in the DOM (consent step rendered)
  const canvas = document.querySelector('canvas');
  await act(async () => {
    fireEvent.mouseDown(canvas);
    fireEvent.mouseUp(canvas);
  });
  fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  });
}

// ── Contact step — disabled state ─────────────────────────────────────────────

describe('BookingModal — contact step disabled state', () => {
  it('Continue is disabled before any fields are filled', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('remains disabled with only a name filled', () => {
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

  it('remains disabled with name and email but no address', () => {
    renderModal();
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'jane@example.com');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('becomes enabled once name, email, and all address fields are provided', () => {
    renderModal();
    fillContactFields();
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
  });
});

// ── Wizard navigation ─────────────────────────────────────────────────────────

describe('BookingModal — wizard navigation', () => {
  it('advancing from contact shows the medical history step', async () => {
    renderModal();
    await advanceToHealth();
    expect(screen.getByLabelText(/current medications/i)).toBeInTheDocument();
  });

  it('advancing from health shows the consent step', async () => {
    renderModal();
    await advanceToConsent();
    expect(screen.getByText(/i have read and agree to the above consent form/i)).toBeInTheDocument();
  });

  it('consent Continue is disabled until canvas is signed and checkbox is checked', async () => {
    renderModal();
    await advanceToConsent();

    const consentBtn = screen.getByRole('button', { name: /continue/i });
    expect(consentBtn).toBeDisabled();

    // Sign — still disabled without checkbox
    const canvas = document.querySelector('canvas');
    await act(async () => {
      fireEvent.mouseDown(canvas);
      fireEvent.mouseUp(canvas);
    });
    expect(consentBtn).toBeDisabled();

    // Check checkbox → now enabled
    fireEvent.click(screen.getByRole('checkbox'));
    expect(consentBtn).not.toBeDisabled();
  });

  it('advancing from consent shows the payment step with a card element', async () => {
    renderModal();
    await advanceToPayment();
    expect(screen.getByTestId('card-element')).toBeInTheDocument();
  });

  it('Back from health returns to the contact step with values preserved', async () => {
    renderModal();
    await advanceToHealth();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /back/i }));
    });
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Doe');
    expect(screen.getByLabelText(/email/i)).toHaveValue('jane@example.com');
  });
});

// ── New-card guest booking — integration ──────────────────────────────────────

describe('BookingModal — new-card guest booking', () => {
  it('tokenizes the card when Book Appointment is clicked', async () => {
    renderModal();
    await advanceToPayment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    expect(mockStripe.createPaymentMethod).toHaveBeenCalledWith({
      type: 'card',
      card: mockCardElement,
    });
  });

  it('confirms payment with the tokenized PM id', async () => {
    renderModal();
    await advanceToPayment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    expect(mockStripe.confirmCardPayment).toHaveBeenCalledWith(
      'cs_test_secret',
      { payment_method: 'pm_test_123' }
    );
  });

  it('shows the success screen after a completed booking', async () => {
    renderModal();
    await advanceToPayment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
    });
  });

  it('shows a card error and stays on the payment step when tokenization fails', async () => {
    mockStripe.createPaymentMethod.mockResolvedValue({
      paymentMethod: null,
      error: { message: 'Your card number is incomplete.' },
    });

    renderModal();
    await advanceToPayment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    expect(screen.getByText(/your card number is incomplete/i)).toBeInTheDocument();
    expect(screen.queryByText(/booking confirmed/i)).not.toBeInTheDocument();
  });
});
