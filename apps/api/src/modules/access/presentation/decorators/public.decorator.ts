import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route (or a whole controller) OUT of the global authentication guard.
 *
 * Every route requires a valid access token by default; use this only for endpoints that must
 * work without being logged in (login, token refresh, account activation, health check, public
 * reference data). The list of public routes is pinned by test/access/route-audit.spec.ts, so
 * making a route public by accident fails the test suite.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
