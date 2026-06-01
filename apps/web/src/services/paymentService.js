import { api } from './api.js';

export const paymentService = {
  createSetupIntent: () => api.post('/payments/setup-intent'),
  listPaymentMethods: () => api.get('/payments/methods'),
  addPaymentMethod: (stripePaymentMethodId) =>
    api.post('/payments/methods', { stripePaymentMethodId }),
  removePaymentMethod: (id) => api.delete(`/payments/methods/${id}`),
  setDefault: (id) => api.put(`/payments/methods/${id}/default`),
  createPaymentIntent: (data) => api.post('/payments/intents', data),
};
