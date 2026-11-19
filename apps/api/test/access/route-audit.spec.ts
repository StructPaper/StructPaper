import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/modules/access/presentation/guards/jwt-auth.guard';
import { IS_OPTIONAL_AUTH_KEY } from '../../src/modules/access/presentation/decorators/optional-auth.decorator';
import { IS_PUBLIC_KEY } from '../../src/modules/access/presentation/decorators/public.decorator';

/**
 * Secure-by-default audit.
 *
 * The API authenticates EVERY route through a global guard unless the route is marked @Public().
 * This test walks all controllers and pins the exact list of public routes: adding a new
 * controller route needs no guard (it is protected automatically), while making one public
 * requires editing this list on purpose, in code review.
 */
const EXPECTED_PUBLIC_ROUTES = [
  'GET /health',
  'POST /auth/login',
  'GET /auth/refresh',
  'POST /auth/refresh',
  'POST /auth/logout',
  'POST /auth/activate',
  'POST /auth/reset-password',
  'GET /journals',
  'GET /journals/:id',
  'GET /journals/:id/article-types',
  'GET /profiles/published',
  'GET /profiles/resolve',
].sort();

const HTTP_METHODS: Record<number, string> = {
  0: 'GET',
  1: 'POST',
  2: 'PUT',
  3: 'DELETE',
  4: 'PATCH',
  5: 'ALL',
  6: 'OPTIONS',
  7: 'HEAD',
};

const controllerModules = import.meta.glob('../../src/modules/**/*.controller.ts', { eager: true }) as Record<
  string,
  Record<string, any>
>;

interface RouteInfo {
  label: string;
  isPublic: boolean;
  isOptionalAuth: boolean;
}

function collectRoutes(): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const controllers = new Set<any>();

  for (const mod of Object.values(controllerModules)) {
    for (const exported of Object.values(mod)) {
      if (typeof exported === 'function' && Reflect.getMetadata('path', exported) !== undefined) {
        controllers.add(exported);
      }
    }
  }

  for (const controller of controllers) {
    const prefix = (Reflect.getMetadata('path', controller) as string) || '';
    const classPublic = Boolean(Reflect.getMetadata(IS_PUBLIC_KEY, controller));

    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      const handler = controller.prototype[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;

      const method = Reflect.getMetadata('method', handler);
      if (method === undefined) continue; // plain helper, not a route

      const path = (Reflect.getMetadata('path', handler) as string) || '';
      const full = ['', prefix, path].join('/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      routes.push({
        label: `${HTTP_METHODS[method] ?? method} ${full}`,
        isOptionalAuth: Boolean(Reflect.getMetadata(IS_OPTIONAL_AUTH_KEY, handler)),
        isPublic: classPublic || Boolean(Reflect.getMetadata(IS_PUBLIC_KEY, handler)),
      });
    }
  }
  return routes;
}

describe('Secure-by-default route audit', () => {
  it('registers JwtAuthGuard as a global guard', () => {
    const providers: any[] = Reflect.getMetadata('providers', AppModule) ?? [];
    expect(providers).toContainEqual({ provide: APP_GUARD, useClass: JwtAuthGuard });
  });

  it('discovers the controllers (sanity check so the audit cannot pass vacuously)', () => {
    const labels = collectRoutes().map((r) => r.label);
    expect(labels.length).toBeGreaterThan(30);
    expect(labels).toContain('POST /users/invite');
    expect(labels).toContain('POST /roles/assign');
    expect(labels).toContain('POST /compile/latex');
    expect(labels).toContain('GET /assets/:id');
  });

  it('exposes EXACTLY the expected public routes, everything else needs a token', () => {
    const publicRoutes = collectRoutes()
      .filter((r) => r.isPublic)
      .map((r) => r.label)
      .sort();

    expect(publicRoutes).toEqual(EXPECTED_PUBLIC_ROUTES);
  });

  it('only reading ONE manuscript (and its PDF) by link works without a token (guests)', () => {
    const optional = collectRoutes().filter((r) => r.isOptionalAuth).map((r) => r.label);
    expect(optional).toEqual(['GET /manuscripts/:id', 'GET /manuscripts/:id/preview']);
  });

  it('never leaves user, role, asset, manuscript or compile routes public', () => {
    const sensitivePrefixes = ['/users', '/roles', '/permissions', '/admin', '/assets', '/manuscripts', '/compile'];
    const exposed = collectRoutes().filter(
      (r) => r.isPublic && sensitivePrefixes.some((p) => r.label.split(' ')[1].startsWith(p)),
    );
    expect(exposed).toEqual([]);
  });
});
