import { describe, it, expect } from 'vitest';
import { absoluteAppLink, activationLinkOf } from '@/lib/absolute-link';

describe('links into the app', () => {
  it('puts the domain in front of a path, whichever domain the app is on', () => {
    expect(absoluteAppLink('/activate#token=abc', 'https://new.example.com')).toBe('https://new.example.com/activate#token=abc');
    expect(absoluteAppLink('/activate#token=abc', 'https://new.example.com/')).toBe('https://new.example.com/activate#token=abc');
    expect(absoluteAppLink('activate', 'http://localhost:3000')).toBe('http://localhost:3000/activate');
  });

  it('leaves a full address as it is', () => {
    expect(absoluteAppLink('https://other.example.com/x', 'https://new.example.com')).toBe('https://other.example.com/x');
  });

  it('uses the page the app is open on when no domain is given', () => {
    expect(absoluteAppLink('/activate#token=abc', undefined).endsWith('/activate#token=abc')).toBe(true);
  });

  it('builds an activation link from the path (the domain in the server\'s link may be stale)', () => {
    const link = activationLinkOf({ activationPath: '/activate#token=t1', activationUrl: 'https://old.example.com/activate#token=t1' });
    expect(link).not.toContain('old.example.com');
    expect(link!.endsWith('/activate#token=t1')).toBe(true);
    expect(activationLinkOf({ activationUrl: 'https://server.example.com/activate#token=t2' })).toBe('https://server.example.com/activate#token=t2');
    expect(activationLinkOf({})).toBeNull();
  });
});
