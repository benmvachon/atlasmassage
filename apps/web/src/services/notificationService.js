import { api } from './api.js';

export const notificationService = {
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (prefs) => api.put('/notifications/preferences', prefs),
  listNotifications: () => api.get('/notifications'),
};
