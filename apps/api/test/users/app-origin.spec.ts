import { describe, it, expect } from 'vitest';
import { normalizeOrigin, resolveAppOrigin } from '../../src/modules/users/application/user.service';

describe('the domain an invitation points to', () => {
  it('reduces an address to its origin and refuses anything that is not http(s)', () => {
    expect(normalizeOrigin('https://app.example.com/papers/1?x=1#y')).toBe('https://app.example.com');
    expect(normalizeOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
    expect(normalizeOrigin('not a url')).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin(null)).toBeNull();
  });

  it('prefers the page the admin is on over a configured APP_URL, so a new domain needs no configuration', () => {
    const env = { APP_URL: 'https://old.example.com', CORS_ORIGIN: 'https://new.example.com' } as any;
    expect(resolveAppOrigin('https://new.example.com/templates', env)).toBe('https://new.example.com');
  });

  it('does not trust a domain that is not one of the allowed web origins', () => {
    const env = { APP_URL: 'https://app.example.com', CORS_ORIGIN: 'https://app.example.com, https://staging.example.com' } as any;
    expect(resolveAppOrigin('https://evil.example.net', env)).toBe('https://app.example.com');
    expect(resolveAppOrigin('https://staging.example.com', env)).toBe('https://staging.example.com');
  });

  it('accepts any page when no origins are configured (development), and falls back to APP_URL without one', () => {
    expect(resolveAppOrigin('http://localhost:3000', {} as any)).toBe('http://localhost:3000');
    expect(resolveAppOrigin(null, { APP_URL: 'https://cheban.example.com/' } as any)).toBe('https://cheban.example.com');
    expect(resolveAppOrigin('http://localhost:3000', { CORS_ORIGIN: '*' } as any)).toBe('http://localhost:3000');
  });

  it('names no domain when there is neither a page nor APP_URL (nothing is invented)', () => {
    expect(resolveAppOrigin(null, {} as any)).toBeNull();
    expect(resolveAppOrigin('garbage', { CORS_ORIGIN: 'https://a.example.com' } as any)).toBeNull();
  });
});
