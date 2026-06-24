import { api } from './api.js';

// Kinesiology / myology educational reference API.
export const anatomyService = {
  listJoints: () => api.get('/anatomy/joints').then(r => r.data),
  getJoint: slug => api.get(`/anatomy/joints/${slug}`).then(r => r.data),
  getJointAction: (slug, actionSlug) =>
    api.get(`/anatomy/joints/${slug}/actions/${actionSlug}`).then(r => r.data),
  getMuscle: slug => api.get(`/anatomy/muscles/${slug}`).then(r => r.data),
};
