import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import BookingModal from '../../components/BookingModal.jsx';
import { bookingService } from '../../services/bookingService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
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

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/booking', search: '' }),
}));

jest.mock('../../context/AuthContext.jsx', () => ({ useAuth: jest.fn() }));

jest.mock('../../services/userService.js', () => ({
  userService: { updateMe: jest.fn() },
}));

jest.mock('../../services/giftCardService.js', () => ({
  giftCardService: { validate: jest.fn() },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SLOT = {
  startTime: '10:00',
  endTime:   '11:00',
  availableDurations: [60],
  availableTherapists: [{ id: 'tid-1', firstName: 'Alice', lastName: 'Smith' }],
};
const SERVICES = [{ id: 'sid-1', name: 'Massage', priceCents: 10000, durationMinutes: 60 }];
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
  useAuth.mockReturnValue({ user: null });
  useStripe.mockReturnValue(mockStripe);
  useElements.mockReturnValue(mockElements);
  userService.updateMe.mockResolvedValue({ data: { user: {} } });
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

/** Click "Continue as guest" if the guest gate is showing. */
async function passGate() {
  const btn = screen.queryByRole('button', { name: /continue as guest/i });
  if (btn) {
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => screen.getByLabelText(/full name/i));
  }
}

/** Advance from the contact step to the health step. */
async function advanceToHealth() {
  await passGate();
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

  it('renders the action buttons inside booking-modal__footer', async () => {
    renderModal();
    await passGate();
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

  it('renders the wizard progress nav inside booking-modal__header', async () => {
    renderModal();
    await passGate();
    const header = document.querySelector('.booking-modal__header');
    expect(header.querySelector('.booking-wizard-progress')).not.toBeNull();
  });
});

// ── Guest gate ────────────────────────────────────────────────────────────────

describe('BookingModal — guest gate', () => {
  it('shows the gate when no user is logged in', () => {
    renderModal();
    expect(screen.getByText(/how would you like to book/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeInTheDocument();
  });

  it('does not show the gate for a logged-in user', async () => {
    renderModalAsLoggedInUser();
    await act(async () => {});
    expect(screen.queryByText(/how would you like to book/i)).not.toBeInTheDocument();
  });

  it('advances to the contact step when "Continue as guest" is clicked', async () => {
    renderModal();
    await passGate();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.queryByText(/how would you like to book/i)).not.toBeInTheDocument();
  });

  it('still shows the slot summary and title on the gate screen', () => {
    renderModal();
    const header = document.querySelector('.booking-modal__header');
    expect(header).toHaveTextContent(/book appointment/i);
    expect(header).toHaveTextContent(/10:00/);
  });
});

// ── Contact step — disabled state ─────────────────────────────────────────────

describe('BookingModal — contact step disabled state', () => {
  it('Continue is disabled before any fields are filled', async () => {
    renderModal();
    await passGate();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('remains disabled with only a name filled', async () => {
    renderModal();
    await passGate();
    fill(/full name/i, 'Jane Doe');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('remains disabled with an invalid email', async () => {
    renderModal();
    await passGate();
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'notanemail');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('remains disabled with name and email but no address', async () => {
    renderModal();
    await passGate();
    fill(/full name/i, 'Jane Doe');
    fill(/email/i, 'jane@example.com');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('becomes enabled once name, email, and all address fields are provided', async () => {
    renderModal();
    await passGate();
    fillContactFields();
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
  });
});

// ── Contact step — address verification ───────────────────────────────────────

describe('BookingModal — contact step address verification', () => {
  it('calls validateAddress with the entered address before advancing', async () => {
    renderModal();
    await passGate();
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
    await passGate();
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
    await passGate();
    fillContactFields();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/unavailable/i);
  });

  it('blocks navigation and shows a service-area error when the address is out of travel range', async () => {
    bookingService.validateAddress.mockResolvedValue({ valid: false, outOfServiceArea: true, driveMinutes: 35 });
    renderModal();
    await passGate();
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

// ── Service selection on payment step ─────────────────────────────────────────

describe('BookingModal — service selection', () => {
  const MULTI_SERVICES = [
    { id: 'sid-60',  name: 'Massage',         priceCents: 15000, durationMinutes: 60  },
    { id: 'sid-90',  name: 'Massage (90 min)', priceCents: 19500, durationMinutes: 90  },
    { id: 'sid-120', name: 'Massage (2 hr)',   priceCents: 24000, durationMinutes: 120 },
  ];
  const SLOT_60_ONLY = { ...SLOT, availableDurations: [60] };
  const SLOT_60_90   = { ...SLOT, availableDurations: [60, 90] };
  const SLOT_ALL     = { ...SLOT, availableDurations: [60, 90, 120] };

  it('renders a service dropdown on the payment step', async () => {
    renderModal({ services: MULTI_SERVICES, slot: SLOT_ALL });
    await advanceToPayment();
    expect(screen.getByLabelText(/service/i)).toBeInTheDocument();
  });

  it('shows only services whose durationMinutes is in slot.availableDurations', async () => {
    renderModal({ services: MULTI_SERVICES, slot: SLOT_60_90 });
    await advanceToPayment();
    const select = screen.getByLabelText(/service/i);
    const values = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(values).toContain('sid-60');
    expect(values).toContain('sid-90');
    expect(values).not.toContain('sid-120');
  });

  it('hides longer services when slot only supports 60-min duration', async () => {
    renderModal({ services: MULTI_SERVICES, slot: SLOT_60_ONLY });
    await advanceToPayment();
    const select = screen.getByLabelText(/service/i);
    const values = Array.from(select.querySelectorAll('option')).map(o => o.value);
    expect(values).toContain('sid-60');
    expect(values).not.toContain('sid-90');
    expect(values).not.toContain('sid-120');
  });

  it('shows all services when slot supports all durations', async () => {
    renderModal({ services: MULTI_SERVICES, slot: SLOT_ALL });
    await advanceToPayment();
    const options = screen.getByLabelText(/service/i).querySelectorAll('option');
    expect(options).toHaveLength(3);
  });

  it('shows all services when slot has no availableDurations', async () => {
    const slotNoMeta = { startTime: '10:00', endTime: '11:00', availableTherapists: SLOT.availableTherapists };
    renderModal({ services: MULTI_SERVICES, slot: slotNoMeta });
    await advanceToPayment();
    const options = screen.getByLabelText(/service/i).querySelectorAll('option');
    expect(options).toHaveLength(3);
  });

  it('slot summary shows only start time regardless of selected service', async () => {
    renderModal({ services: MULTI_SERVICES, slot: SLOT_ALL });
    await advanceToPayment();

    const summary = document.querySelector('.booking-modal__slot-summary');
    expect(summary).toHaveTextContent('10:00 AM');
    expect(summary).not.toHaveTextContent('11:00 AM');

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/service/i), { target: { value: 'sid-90' } });
    });
    expect(summary).toHaveTextContent('10:00 AM');
    expect(summary).not.toHaveTextContent('11:30 AM');
  });

  it('sends the selected serviceId in the createAppointment call', async () => {
    renderModal({ services: MULTI_SERVICES, slot: SLOT_ALL });
    await advanceToPayment();

    await act(async () => {
      fireEvent.change(screen.getByLabelText(/service/i), { target: { value: 'sid-90' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));
    });

    expect(bookingService.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'sid-90' })
    );
  });
});

// ── Address step (logged-in client, travel mode) ──────────────────────────────

const LOGGED_IN_USER_NO_ADDR = {
  id: 'uid-1', email: 'jane@example.com',
  first_name: 'Jane', last_name: 'Doe', roles: ['client'],
  address_line1: null, city: null, state: null, zip: null,
};

const LOGGED_IN_USER_WITH_ADDR = {
  ...LOGGED_IN_USER_NO_ADDR,
  address_line1: '10 Elm St', city: 'Newton', state: 'MA', zip: '02458',
};

function renderModalAsLoggedInUser(user = LOGGED_IN_USER_NO_ADDR) {
  useAuth.mockReturnValue({ user });
  return renderModal();
}

describe('BookingModal — address step (logged-in client, travel mode on)', () => {
  beforeEach(() => {
    bookingService.getTravelSettings.mockResolvedValue({ travel_mode_enabled: true });
    // Consent and health not on file → steps: address → health → consent → payment
    bookingService.getConsentStatus.mockResolvedValue({ data: { hasSigned: false, signedAt: null } });
    bookingService.getHealthStatus.mockResolvedValue({ data: { hasRecord: false } });
  });

  it('shows the address step first when client has no address on file', async () => {
    renderModalAsLoggedInUser(LOGGED_IN_USER_NO_ADDR);
    await act(async () => {});
    expect(await screen.findByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument(); // not contact step
  });

  it('Continue is disabled until all required address fields are filled', async () => {
    renderModalAsLoggedInUser(LOGGED_IN_USER_NO_ADDR);
    await act(async () => {});
    await screen.findByLabelText(/street address/i);
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();

    fill(/street address/i, '10 Elm St');
    fill(/city/i, 'Newton');
    fill(/state/i, 'MA');
    fill(/zip code/i, '02458');
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();
  });

  it('validates address and saves to profile before advancing to health step', async () => {
    renderModalAsLoggedInUser(LOGGED_IN_USER_NO_ADDR);
    await act(async () => {});
    await screen.findByLabelText(/street address/i);

    fill(/street address/i, '10 Elm St');
    fill(/city/i, 'Newton');
    fill(/state/i, 'MA');
    fill(/zip code/i, '02458');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });

    expect(bookingService.validateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ addressLine1: '10 Elm St', city: 'Newton', state: 'MA', zip: '02458' })
    );
    expect(userService.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ addressLine1: '10 Elm St', city: 'Newton', state: 'MA', zip: '02458' })
    );
    // Advanced to health step
    expect(await screen.findByLabelText(/current medications/i)).toBeInTheDocument();
  });

  it('blocks advance and shows error when address is out of service area', async () => {
    bookingService.validateAddress.mockResolvedValue({ valid: false, outOfServiceArea: true, driveMinutes: 45 });
    renderModalAsLoggedInUser(LOGGED_IN_USER_NO_ADDR);
    await act(async () => {});
    await screen.findByLabelText(/street address/i);

    fill(/street address/i, '999 Far Away Rd');
    fill(/city/i, 'Distant City');
    fill(/state/i, 'CA');
    fill(/zip code/i, '90210');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/outside our 20-minute travel service area/i);
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(userService.updateMe).not.toHaveBeenCalled();
  });

  it('skips address step when client already has address on file', async () => {
    renderModalAsLoggedInUser(LOGGED_IN_USER_WITH_ADDR);
    await act(async () => {});
    // Should land on health step, not address step
    expect(await screen.findByLabelText(/current medications/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument();
  });

  it('skips address step when travel mode is disabled', async () => {
    bookingService.getTravelSettings.mockResolvedValue({ travel_mode_enabled: false });
    renderModalAsLoggedInUser(LOGGED_IN_USER_NO_ADDR);
    await act(async () => {});
    // With no consent/health on file, first step for logged-in user is health
    expect(await screen.findByLabelText(/current medications/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/street address/i)).not.toBeInTheDocument();
  });
});
