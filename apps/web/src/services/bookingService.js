import { api } from './api.js';

export const bookingService = {
  async getCalendar(year, month, therapistId, timeOfDay) {
    const params = new URLSearchParams({ year, month });
    if (therapistId) params.set('therapistId', therapistId);
    if (timeOfDay) params.set('timeOfDay', timeOfDay);
    const res = await api.get(`/availability/booking/calendar?${params}`);
    return res.data;
  },

  async getSlots(date, therapistId, timeOfDay) {
    const params = new URLSearchParams({ date });
    if (therapistId) params.set('therapistId', therapistId);
    if (timeOfDay) params.set('timeOfDay', timeOfDay);
    const res = await api.get(`/availability/booking/slots?${params}`);
    return res.data;
  },

  async getBookingRestrictions() {
    const res = await api.get('/business/restrictions');
    return res.data;
  },

  async getConsentStatus() {
    const res = await api.get('/appointments/consent/status');
    return res.data;
  },

  async getHealthStatus() {
    const res = await api.get('/appointments/health/status');
    return res.data;
  },

  async createAppointment(data) {
    const res = await api.post('/appointments', data);
    return res.data;
  },

  async confirmAppointment(id, cancelToken, stripePaymentMethodId) {
    const body = {};
    if (cancelToken) body.cancelToken = cancelToken;
    if (stripePaymentMethodId) body.stripePaymentMethodId = stripePaymentMethodId;
    const res = await api.post(`/appointments/${id}/confirm`, body);
    return res.data;
  },

  async cancelAppointment(id, cancelToken) {
    const res = await api.post(`/appointments/${id}/cancel`, { cancelToken });
    return res.data;
  },

  async validateAddress({ addressLine1, addressLine2, city, state, zip }) {
    const res = await api.post('/appointments/validate-address', { addressLine1, addressLine2, city, state, zip });
    return res.data;
  },
};
