import { api } from './api.js';

export const adminService = {
  // Dashboard summary
  getDashboard: () => api.get('/admin/dashboard'),

  // Business overview
  getBusinessDetails: () => api.get('/admin/business'),
  updateBusinessHours: (dayOfWeek, data) => api.put(`/admin/business/hours/${dayOfWeek}`, data),
  getBookingRestrictions: () => api.get('/admin/business/restrictions'),
  updateBookingRestrictions: (data) => api.put('/admin/business/restrictions', data),

  // Massage tables
  listMassageBeds: () => api.get('/admin/business/beds'),
  createMassageBed: (data) => api.post('/admin/business/beds', data),
  updateMassageBed: (id, data) => api.put(`/admin/business/beds/${id}`, data),
  deleteMassageBed: (id) => api.delete(`/admin/business/beds/${id}`),

  // Services
  listServices: () => api.get('/admin/services'),
  createService: (data) => api.post('/admin/services', data),
  updateService: (id, data) => api.put(`/admin/services/${id}`, data),
  deactivateService: (id) => api.delete(`/admin/services/${id}`),

  // Therapists
  listTherapists: () => api.get('/admin/therapists'),
  createTherapist: (data) => api.post('/admin/therapists', data),
  updateTherapist: (id, data) => api.put(`/admin/therapists/${id}`, data),
  uploadTherapistHeadshot: (id, file) => {
    const fd = new FormData();
    fd.append('headshot', file);
    return api.upload(`/admin/therapists/${id}/headshot`, fd);
  },
  deactivateTherapist: (id) => api.delete(`/admin/therapists/${id}`),

  // Appointments (calendar)
  listAppointments: (start, end, therapistId) => {
    const params = new URLSearchParams({ start, end });
    if (therapistId) params.set('therapistId', therapistId);
    return api.get(`/admin/appointments?${params}`);
  },
  updateAppointmentStatus: (id, status) =>
    api.patch(`/admin/appointments/${id}/status`, { status }),
  chargeNoShow: (id, amountCents) =>
    api.post(`/admin/appointments/${id}/charge-no-show`, amountCents ? { amountCents } : {}),
  recordInPersonPayment: (id, amountCents, method) =>
    api.post(`/admin/appointments/${id}/record-payment`, { amountCents, method }),

  // Revenue
  getRevenue: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return api.get(`/admin/revenue?${params}`);
  },

  // Testimonials
  listTestimonials: () => api.get('/admin/testimonials'),
  createTestimonial: (data) => api.post('/admin/testimonials', data),
  updateTestimonial: (id, data) => api.put(`/admin/testimonials/${id}`, data),
  deleteTestimonial: (id) => api.delete(`/admin/testimonials/${id}`),

  // Membership plans
  listMembershipPlans: () => api.get('/admin/membership-plans'),
  createMembershipPlan: (data) => api.post('/admin/membership-plans', data),
  updateMembershipPlan: (id, data) => api.put(`/admin/membership-plans/${id}`, data),

  // Transfer requests
  listTransferRequests: () => api.get('/admin/transfer-requests'),
  approveTransferRequest: (id, toTherapistId) =>
    api.post(`/admin/transfer-requests/${id}/approve`, { toTherapistId }),
  denyTransferRequest: (id) =>
    api.post(`/admin/transfer-requests/${id}/deny`),
};
