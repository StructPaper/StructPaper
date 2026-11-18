import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * The route works for guests too: without an Authorization header the request goes on as
 * anonymous (request.user is undefined) and the handler must apply the guest rules itself.
 * A token that IS sent is still verified strictly (an expired one is 401, so the client can refresh).
 *
 * Only for read-by-link endpoints. The list of such routes is pinned by test/access/route-audit.spec.ts.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
