import { useMemo } from 'react';
import type { Capability } from '@structpaper/contracts';
import { useAuthStore, type AuthUser } from '@/lib/auth-store';

/**
 * Frontend access control: the UI asks WHAT the user can do (capabilities), never WHO they are.
 * The server computes the capabilities (GET /auth/me) with the same rules as its guards, so this
 * only decides what to show: hiding a button never protects data, the API still checks.
 */

/**
 * anonymous  no session
 * loading    logged in, capabilities not received yet -> everything is denied (default deny)
 * ready      capabilities known (from the server or the last cached copy)
 */
export type AccessStatus = 'anonymous' | 'loading' | 'ready';

/** Why something is not allowed; one central message table (see denyMessage). */
export type DenyReason = 'LOADING' | 'NO_PERMISSION';

export type Decision = { allowed: true } | { allowed: false; reason: DenyReason };

export interface Access {
  status: AccessStatus;
  /** True only when the capability is known to be granted. */
  can: (capability: Capability) => boolean;
  /** Same as `can`, with the reason when denied (to hide, disable or explain). */
  explain: (capability: Capability) => Decision;
  /** Every listed capability is granted. */
  canAll: (...capabilities: Capability[]) => boolean;
  /** At least one listed capability is granted. */
  canAny: (...capabilities: Capability[]) => boolean;
}

/** Pure factory (no React): easy to unit test and to reuse outside components. */
export function createAccess(user: Pick<AuthUser, 'capabilities'> | null | undefined): Access {
  const status: AccessStatus = !user ? 'anonymous' : user.capabilities ? 'ready' : 'loading';
  const granted = new Set<Capability>(user?.capabilities ?? []);

  const explain = (capability: Capability): Decision => {
    if (status !== 'ready') return { allowed: false, reason: 'LOADING' };
    return granted.has(capability) ? { allowed: true } : { allowed: false, reason: 'NO_PERMISSION' };
  };

  return {
    status,
    can: (capability) => explain(capability).allowed,
    explain,
    canAll: (...capabilities) => capabilities.every((c) => explain(c).allowed),
    canAny: (...capabilities) => capabilities.some((c) => explain(c).allowed),
  };
}

/** The access of the logged-in user. The object only changes when the capabilities change. */
export function useAccess(): Access {
  const capabilities = useAuthStore((s) => s.user?.capabilities);
  const loggedIn = useAuthStore((s) => Boolean(s.user));

  return useMemo(
    () => createAccess(loggedIn ? { capabilities } : null),
    [loggedIn, capabilities],
  );
}

/** One place for the wording shown when something is denied (same text on every screen). */
export function denyMessage(decision: Decision): string | undefined {
  if (decision.allowed) return undefined;
  switch (decision.reason) {
    case 'LOADING':
      return 'Đang kiểm tra quyền...';
    case 'NO_PERMISSION':
    default:
      return 'Bạn không có quyền thực hiện thao tác này.';
  }
}
