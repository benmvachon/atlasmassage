import { api } from './api.js';

export const membershipService = {
  getPlans: () => api.get('/memberships/plans'),
  getMyMemberships: () => api.get('/memberships'),
  getMyStatus: () => api.get('/memberships/status'),
  subscribe: (planId, stripePaymentMethodId) =>
    api.post('/memberships', { planId, stripePaymentMethodId }),
  cancel: (id) => api.post(`/memberships/${id}/cancel`),
};
