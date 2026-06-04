import { api } from './api.js';

// Single-flight guard: React 18 StrictMode invokes effects twice in dev mode,
// which would fire two concurrent POST /auth/refresh calls with the same
// rotating token. The second call fails (token already rotated) and triggers
// clearSession(), leaving user=null. Deduplicating ensures only one network
// request is in-flight at a time.
let _refreshInFlight = null;

export const authService = {
  register: ({ email, password, firstName, lastName, phone }) =>
    api.post('/auth/register', { email, password, firstName, lastName, phone })
      .then(res => res.data),

  login: ({ email, password }) =>
    api.post('/auth/login', { email, password })
      .then(res => res.data),

  logout: () => api.post('/auth/logout'),

  refresh: () => {
    if (!_refreshInFlight) {
      _refreshInFlight = api.post('/auth/refresh')
        .then(res => res.data)
        .finally(() => { _refreshInFlight = null; });
    }
    return _refreshInFlight;
  },

  forgotPassword: ({ email }) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: ({ token, password }) =>
    api.post('/auth/reset-password', { token, password }),
};
