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

  async createAppointment(data) {
    const res = await api.post('/appointments', data);
    return res.data;
  },
};
