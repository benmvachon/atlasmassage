export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail    = v => !!v && EMAIL_RE.test(v);
export const isValidPassword = v => !!v && v.length >= 8;
export const isNonEmpty      = v => typeof v === 'string' && v.trim().length > 0;
