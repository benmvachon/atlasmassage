import { api } from './api.js';

export const adminService = {
  // Business overview
  getBusinessDetails: () => api.get('/admin/business'),
  updateBusinessHours: (dayOfWeek, data) => api.put(`/admin/business/hours/${dayOfWeek}`, data),

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
  deactivateTherapist: (id) => api.delete(`/admin/therapists/${id}`),
};
