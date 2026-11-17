import { http, getAccessToken } from '@structpaper/api-client';

/** Refresh when the access token has less than this many seconds left. */
const REFRESH_MARGIN_SECONDS = 60;

/** Seconds until the JWT expires (decoded locally, not verified); 0 when unreadable. */
export function secondsUntilExpiry(token: string, now: number = Date.now()): number {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp - now / 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Authorization header for plain `fetch` calls (compile requests).
 *
 * Access tokens live 15 minutes and only the axios client refreshes them on a 401, so before a
 * plain fetch we make one cheap authenticated call when the token is about to expire: the axios
 * interceptor refreshes it transparently and stores the new token. Returns {} when there is no
 * session at all (the server will answer 401 and the UI explains it).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  let token = getAccessToken();

  if (token && secondsUntilExpiry(token) < REFRESH_MARGIN_SECONDS) {
    try {
      await http.get('/api/v1/auth/me', { skipGlobalToast: true });
    } catch {
      // refresh failed: fall through with whatever token we have; the server decides
    }
    token = getAccessToken();
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}
