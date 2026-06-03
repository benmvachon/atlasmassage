const BASE_URL = '/api/v1';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

async function request(method, path, body, { multipart = false } = {}) {
  const headers = {};
  if (!multipart) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(body !== undefined && { body: multipart ? body : JSON.stringify(body) }),
  });

  // Vite's proxy-error responses are plain text, not JSON.
  // Guard here so a failed proxy doesn't surface a cryptic SyntaxError.
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error('Service unavailable. Please try again shortly.');
    err.status = res.status;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || 'Request failed');
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get: path => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),
  upload: (path, formData) => request('POST', path, formData, { multipart: true }),
};
