import { api } from './api.js';

export const authService = {
  register: ({ email, password, firstName, lastName, phone }) =>
    api.post('/auth/register', { email, password, firstName, lastName, phone })
      .then(res => res.data),

  login: ({ email, password }) =>
    api.post('/auth/login', { email, password })
      .then(res => res.data),

  logout: () => api.post('/auth/logout'),

  refresh: () =>
    api.post('/auth/refresh')
      .then(res => res.data),
};
