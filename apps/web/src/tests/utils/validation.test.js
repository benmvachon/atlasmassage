import { isValidEmail, isValidPassword, isNonEmpty, EMAIL_RE } from '../../utils/validation.js';

describe('isValidEmail', () => {
  it('returns true for a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('returns true for emails with subdomains', () => {
    expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('returns false for null / undefined', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });

  it('returns false when @ is missing', () => {
    expect(isValidEmail('notanemail')).toBe(false);
  });

  it('returns false when domain is missing', () => {
    expect(isValidEmail('user@')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('returns true for a password with 8 or more characters', () => {
    expect(isValidPassword('password')).toBe(true);
    expect(isValidPassword('longerpassword')).toBe(true);
  });

  it('returns false for a password shorter than 8 characters', () => {
    expect(isValidPassword('short')).toBe(false);
    expect(isValidPassword('1234567')).toBe(false);
  });

  it('returns false for empty string, null, or undefined', () => {
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(undefined)).toBe(false);
  });
});

describe('isNonEmpty', () => {
  it('returns true for a non-empty, non-whitespace string', () => {
    expect(isNonEmpty('hello')).toBe(true);
    expect(isNonEmpty('  hi  ')).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isNonEmpty('')).toBe(false);
  });

  it('returns false for whitespace-only strings', () => {
    expect(isNonEmpty('   ')).toBe(false);
    expect(isNonEmpty('\t\n')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isNonEmpty(null)).toBe(false);
    expect(isNonEmpty(undefined)).toBe(false);
    expect(isNonEmpty(42)).toBe(false);
  });
});

describe('EMAIL_RE', () => {
  it('is exported for use in other validators', () => {
    expect(EMAIL_RE).toBeInstanceOf(RegExp);
  });
});
