import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import BookingModal from '../../components/BookingModal.jsx';
import { bookingService } from '../../services/bookingService.js';
import { ALL_SERVICES } from '../../data/services.js';

// ── Stripe mocks ──────────────────────────────────────────────────────────────

const mockStripe = {
  confirmCardSetup: jest.fn(),
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
    createAppointment:      jest.fn(),
    confirmAppointment:     jest.fn().mockResolvedValue({}),
    cancelAppointment:      jest.fn().mockResolvedValue({}),
    getConsentStatus:       jest.fn().mockResolvedValue({ data: { hasSigned: false, signedAt: null } }),
    getHealthStatus:        jest.fn().mockResolvedValue({ data: { hasRecord: false } }),
    getBookingRestrictions: jest.fn().mockResolvedValue({ restrict_pregnancy: false, restrict_minors: false }),
    getTravelSettings:      jest.fn().mockResolvedValue({ travel_mode_enabled: false }),
    validateAddress:        jest.fn(),
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
  bookingService.validateAddress.mockResolvedValue({ valid: true, formattedAddress: null, unconfirmedComponentTypes: [] });
  mockStripe.confirmCardSetup.mockResolvedValue({
    setupIntent: { payment_method: 'pm_test_123' },
    error: null,
  });
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
  screen.getAllByRole('checkbox').forEach(cb => fireEvent.click(cb));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  });
}

// ── Sticky layout structure ───────────────────────────────────────────────────

describe('BookingModal — sticky layout structure', () => {
  it('renders the title inside booking-modal__header on the contact step', () => {
    renderModal();
    const header = document.querySelector('.booking-modal__header');
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent(/book appointment/i);
  });

  it('renders the slot summary inside booking-modal__header', () => {
    renderModal();
    const header = document.querySelector('.booking-modal__header');
    expect(header).toHaveTextContent(/10:00/);
  });

  it('renders a scrollable body section on the contact step', () => {
    renderModal();
    expect(document.querySelector('.booking-modal__body')).not.toBeNull();
  });

  it('renders the action buttons inside booking-modal__footer', () => {
    renderModal();
    const footer = document.querySelector('.booking-modal__footer');
    expect(footer).not.toBeNull();
    expect(footer.querySelector('button')).not.toBeNull();
  });

  it('keeps the header visible when navigating to the health step', async () => {
    renderModal();
    await advanceToHealth();
    const header = document.querySelector('.booking-modal__header');
    expect(header).not.toBeNull();
    expect(header).toHaveTextContent(/book appointment/i);
  });

  it('keeps the footer visible on the consent step', async () => {
    renderModal();
    await advanceToConsent();
    const footer = document.querySelector('.booking-modal__footer');
    expect(footer).not.toBeNull();
    expect(footer.querySelector('button')).not.toBeNull();
  });

  it('keeps the footer visible on the payment step', async () => {
    renderModal();
    await advanceToPayment();
    const footer = document.querySelector('.booking-modal__footer');
    expect(footer).not.toBeNull();
    expect(footer).toHaveTextContent(/book appointment/i);
  });

  it('renders the wizard progress nav inside booking-modal__header', () => {
    renderModal();
    const header = document.querySelector('.booking-modal__header');
    expect(header.querySelector('.booking-wizard-progress')).not.toBeNull();
  });
});

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

// ── Contact step — address verification ───────────────────────────────────────

describe('BookingModal — contact step address verification', () => {
  it('calls validateAddress with the entered address before advancing', async () => {
    renderModal();
    fillContactFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });
    expect(bookingService.validateAddress).toHaveBeenCalledWith({
      addressLine1: '123 Test St',
      addressLine2: undefined,
      city: 'Test City',
      state: 'CA',
      zip: '12345',
    });
    expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument();
  });

  it('blocks navigation and shows an error when the address cannot be verified', async () => {
    bookingService.validateAddress.mockResolvedValue({ valid: false, formattedAddress: null, unconfirmedComponentTypes: ['locality'] });
    renderModal();
    fillContactFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't verify this address/i);
    // Still on the contact step
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
  });

  it('shows an error when the verification request fails', async () => {
    bookingService.validateAddress.mockRejectedValue(new Error('Address verification service is unavailable. Please try again.'));
    renderModal();
    fillContactFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
  });

  it('blocks navigation and shows a service-area error when the address is out of travel range', async () => {
    bookingService.validateAddress.mockResolvedValue({ valid: false, outOfServiceArea: true, driveMinutes: 35 });
    renderModal();
    fillContactFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/outside our 20-minute travel service area/i);
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
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

  it('consent Continue is disabled until canvas is signed and both checkboxes are checked', async () => {
    renderModal();
    await advanceToConsent();

    const consentBtn = screen.getByRole('button', { name: /continue/i });
    expect(consentBtn).toBeDisabled();

    // Sign — still disabled without checkboxes
    const canvas = document.querySelector('canvas');
    await act(async () => {
      fireEvent.mouseDown(canvas);
      fireEvent.mouseUp(canvas);
    });
    expect(consentBtn).toBeDisabled();

    // Check first checkbox only — still disabled
    const [waiverBox, cancellationBox] = screen.getAllByRole('checkbox');
    fireEvent.click(waiverBox);
    expect(consentBtn).toBeDisabled();

    // Check second checkbox → now enabled
    fireEvent.click(cancellationBox);
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

// ── Consent step — services explanation & travel acknowledgement ──────────────

describe('BookingModal — consent step content', () => {
  it('lists the explanations of all services offered, matching the Services page', async () => {
    renderModal();
    await advanceToConsent();
    expect(screen.getByText('Services We Offer')).toBeInTheDocument();
    const servicesText = document.querySelector('.waiver-services').textContent;
    for (const service of ALL_SERVICES) {
      expect(servicesText).toContain(service.name);
      expect(servicesText).toContain(service.description);
    }
  });

  it('does not include the travel acknowledgement when travel mode is disabled', async () => {
    bookingService.getTravelSettings.mockResolvedValueOnce({ travel_mode_enabled: false });
    renderModal();
    await advanceToConsent();
    expect(screen.queryByText(/i will provide a clean, private, and suitable space/i)).not.toBeInTheDocument();
  });

  it('includes the travel acknowledgement when travel mode is enabled', async () => {
    bookingService.getTravelSettings.mockResolvedValueOnce({ travel_mode_enabled: true });
    renderModal();
    await advanceToConsent();
    expect(screen.getByText(/i will provide a clean, private, and suitable space/i)).toBeInTheDocument();
  });
});

// ── New-card guest booking — integration ──────────────────────────────────────

describe('BookingModal — new-card guest booking', () => {
  it('calls confirmCardSetup with the card element when Book Appointment is clicked', async () => {
    renderModal();
    await advanceToPayment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    expect(mockStripe.confirmCardSetup).toHaveBeenCalledWith(
      'cs_test_secret',
      { payment_method: { card: mockCardElement } }
    );
  });

  it('confirms the appointment with the PM id from the setup intent', async () => {
    renderModal();
    await advanceToPayment();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    await waitFor(() => {
      expect(bookingService.confirmAppointment).toHaveBeenCalledWith(
        'appt-1',
        undefined,
        'pm_test_123'
      );
    });
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
    mockStripe.confirmCardSetup.mockResolvedValue({
      setupIntent: null,
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
