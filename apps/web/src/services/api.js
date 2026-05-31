const BASE_URL = '/api/v1';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const data = await res.json();

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
  delete: path => request('DELETE', path),
};
