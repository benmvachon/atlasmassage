import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MembershipProvider, useMembership } from '../../context/MembershipContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { membershipService } from '../../services/membershipService.js';

jest.mock('../../context/AuthContext.jsx', () => ({ useAuth: jest.fn() }));

jest.mock('../../services/membershipService.js', () => ({
  membershipService: {
    getMyMemberships: jest.fn(),
    subscribe:        jest.fn(),
    cancel:           jest.fn(),
  },
}));

const MOCK_USER = { id: 'u1', email: 'jane@example.com' };

const ACTIVE_MEM   = { id: 'm1', plan_id: 'p1', status: 'active',    plan_name: 'Wellness' };
const INACTIVE_MEM = { id: 'm2', plan_id: 'p2', status: 'cancelled', plan_name: 'Basic'    };

function Consumer() {
  const { memberships, activeMembership, loading, error, subscribe, cancel } = useMembership();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="error">{error ?? 'none'}</div>
      <div data-testid="count">{memberships.length}</div>
      <div data-testid="active">{activeMembership?.plan_name ?? 'none'}</div>
      <button onClick={() => subscribe('plan-id')}>Subscribe</button>
      <button onClick={() => cancel('m1')}>Cancel</button>
    </div>
  );
}

function wrap(user = MOCK_USER) {
  useAuth.mockReturnValue({ user });
  return render(
    <MembershipProvider>
      <Consumer />
    </MembershipProvider>
  );
}

beforeEach(() => { jest.clearAllMocks(); });

describe('MembershipProvider — loading', () => {
  it('fetches memberships on mount when user is present', async () => {
    membershipService.getMyMemberships.mockResolvedValue({ data: { memberships: [ACTIVE_MEM] } });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('identifies the active membership', async () => {
    membershipService.getMyMemberships.mockResolvedValue({
      data: { memberships: [INACTIVE_MEM, ACTIVE_MEM] },
    });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('active')).toHaveTextContent('Wellness');
  });

  it('sets error when getMyMemberships fails', async () => {
    membershipService.getMyMemberships.mockRejectedValue(new Error('Network down'));
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('error')).toHaveTextContent('Network down');
  });

  it('does not fetch and stays not-loading when user is null', async () => {
    wrap(null);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(membershipService.getMyMemberships).not.toHaveBeenCalled();
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});

describe('MembershipProvider — subscribe', () => {
  it('optimistically adds the new membership to the list', async () => {
    membershipService.getMyMemberships.mockResolvedValue({ data: { memberships: [] } });
    membershipService.subscribe.mockResolvedValue({ data: { membership: ACTIVE_MEM } });
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(membershipService.subscribe).toHaveBeenCalledWith('plan-id');
  });
});

describe('MembershipProvider — cancel', () => {
  it('calls membershipService.cancel and reloads memberships', async () => {
    membershipService.getMyMemberships.mockResolvedValue({ data: { memberships: [ACTIVE_MEM] } });
    membershipService.cancel.mockResolvedValue();
    wrap();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(membershipService.cancel).toHaveBeenCalledWith('m1');
    expect(membershipService.getMyMemberships).toHaveBeenCalledTimes(2);
  });
});

describe('useMembership — guard', () => {
  it('throws when used outside of MembershipProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() { useMembership(); return null; }
    expect(() => render(<Bad />)).toThrow('useMembership must be used within <MembershipProvider>');
    spy.mockRestore();
  });
});
