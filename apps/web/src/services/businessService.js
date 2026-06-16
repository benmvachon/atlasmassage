import { api } from './api.js';

export const businessService = {
  getHours: () => api.get('/business/hours'),
  getContactInfo: () => api.get('/business/contact-info'),
};
