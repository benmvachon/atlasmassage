import { api } from './api.js';

function normalizeDate(d) {
  return String(d).slice(0, 10);
}

export const availabilityService = {
  async getTherapistMonth(therapistId, year, month) {
    const res = await api.get(
      `/availability/therapists/${therapistId}?year=${year}&month=${month}`
    );
    return {
      ...res.data,
      availability: res.data.availability.map(a => ({
        ...a,
        specific_date: normalizeDate(a.specific_date),
      })),
    };
  },

  async setAvailability(therapistId, entries) {
    const res = await api.put(`/availability/therapists/${therapistId}`, { entries });
    return res.data.map(a => ({ ...a, specific_date: normalizeDate(a.specific_date) }));
  },

  removeAvailability(therapistId, dates) {
    return api.delete(`/availability/therapists/${therapistId}/dates`, { dates });
  },

  updateLimits(therapistId, dailyBookingLimit, weeklyBookingLimit) {
    return api.patch(`/availability/therapists/${therapistId}/limits`, {
      dailyBookingLimit,
      weeklyBookingLimit,
    });
  },
};
