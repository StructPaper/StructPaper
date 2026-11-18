import { describe, it, expect, afterEach, vi } from 'vitest';
import { http, setAccessToken } from '@structpaper/api-client';
import { getAuthHeaders, secondsUntilExpiry } from '@/lib/auth-headers';

/** Unsigned JWT-shaped token carrying only an `exp` claim (the helper never verifies it). */
const tokenExpiringIn = (seconds: number) => {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + seconds })}.sig`;
};

describe('getAuthHeaders (bearer token for plain fetch calls)', () => {
  afterEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('returns no header when there is no session', async () => {
    const getSpy = vi.spyOn(http, 'get');

    expect(await getAuthHeaders()).toEqual({});
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('returns the current token without any extra request while it is still fresh', async () => {
    const token = tokenExpiringIn(600);
    setAccessToken(token);
    const getSpy = vi.spyOn(http, 'get');

    expect(await getAuthHeaders()).toEqual({ Authorization: `Bearer ${token}` });
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('refreshes a token that is about to expire (via the axios client) and uses the NEW one', async () => {
    setAccessToken(tokenExpiringIn(10));
    const fresh = tokenExpiringIn(900);
    // The axios interceptor refreshes on 401 and stores the new token: simulate that effect
    const getSpy = vi.spyOn(http, 'get').mockImplementation(async () => {
      setAccessToken(fresh);
      return {} as any;
    });

    expect(await getAuthHeaders()).toEqual({ Authorization: `Bearer ${fresh}` });
    expect(getSpy).toHaveBeenCalledWith('/api/v1/auth/me', { skipGlobalToast: true });
  });

  it('falls back to the existing token when the refresh fails (the server decides)', async () => {
    const stale = tokenExpiringIn(5);
    setAccessToken(stale);
    vi.spyOn(http, 'get').mockRejectedValue(new Error('refresh failed'));

    expect(await getAuthHeaders()).toEqual({ Authorization: `Bearer ${stale}` });
  });

  it('secondsUntilExpiry reads the exp claim and treats garbage as already expired', () => {
    expect(secondsUntilExpiry(tokenExpiringIn(100))).toBeGreaterThan(95);
    expect(secondsUntilExpiry('not-a-jwt')).toBe(0);
  });
});
