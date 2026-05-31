import { issueAccessToken, verifyAccessToken, generateRefreshToken, generateResetToken, hashToken } from '../services/tokenService.js';

const MOCK_USER = { id: 'uuid-1', roles: ['client'] };

describe('issueAccessToken / verifyAccessToken', () => {
  it('issues a token that verifies correctly', () => {
    const token = issueAccessToken(MOCK_USER);
    expect(typeof token).toBe('string');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(MOCK_USER.id);
    expect(payload.roles).toEqual(['client']);
  });

  it('throws on a tampered token', () => {
    const token = issueAccessToken(MOCK_USER);
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe('generateRefreshToken', () => {
  it('returns a raw token and its hash', () => {
    const { raw, hash, expiresAt } = generateRefreshToken();
    expect(typeof raw).toBe('string');
    expect(raw.length).toBeGreaterThan(20);
    expect(hash).toBe(hashToken(raw));
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt > new Date()).toBe(true);
  });

  it('produces unique tokens on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('generateResetToken', () => {
  it('expires in approximately 1 hour', () => {
    const { expiresAt } = generateResetToken();
    const diffMs = expiresAt - new Date();
    expect(diffMs).toBeGreaterThan(59 * 60 * 1000);
    expect(diffMs).toBeLessThan(61 * 60 * 1000);
  });
});

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('def'));
  });
});
