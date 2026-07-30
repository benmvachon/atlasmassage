import { api } from './api.js';

// Published pathology essays. The PDF download is a plain browser navigation
// rather than a fetch, so the file is saved instead of buffered into memory.
export const essayService = {
  list: () => api.get('/essays').then(r => r.data),
  get: slug => api.get(`/essays/${slug}`).then(r => r.data),
  pdfUrl: slug => `/api/v1/essays/${slug}/pdf`,
};
