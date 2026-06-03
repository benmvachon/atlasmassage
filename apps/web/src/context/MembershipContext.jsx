import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { membershipService } from '../services/membershipService.js';
import { useAuth } from './AuthContext.jsx';

const MembershipContext = createContext(null);

export function MembershipProvider({ children }) {
  const { user } = useAuth();

  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    membershipService.getMyMemberships()
      .then(({ data }) => setMemberships(data.memberships))
      .catch(err => setError(err.message || 'Failed to load membership.'))
      .finally(() => setLoading(false));
  }, [user]);

  // Re-fetch whenever the logged-in user changes.
  useEffect(() => {
    if (user) {
      load();
    } else {
      setMemberships([]);
      setError(null);
      setLoading(false);
    }
  }, [user, load]);

  const activeMembership = memberships.find(m => m.status === 'active') ?? null;

  const subscribe = useCallback(async (planId, stripePaymentMethodId) => {
    const { data } = await membershipService.subscribe(planId, stripePaymentMethodId);
    setMemberships(prev => [...prev, data.membership]);
    return data.membership;
  }, []);

  const cancel = useCallback(async id => {
    await membershipService.cancel(id);
    load();
  }, [load]);

  return (
    <MembershipContext.Provider
      value={{ memberships, activeMembership, loading, error, subscribe, cancel, reload: load }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  const ctx = useContext(MembershipContext);
  if (!ctx) throw new Error('useMembership must be used within <MembershipProvider>');
  return ctx;
}
