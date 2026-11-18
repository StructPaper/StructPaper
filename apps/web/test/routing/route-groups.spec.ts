import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Structure of the Next.js app router:
 *
 *   app/(public)         pages reachable without a session, no dock, no session check
 *   app/(authenticate)   pages that need a logged-in user (AuthGuard)
 *     (main)             with the dock / bottom navigation
 *     (workspace)        focused full-window workspaces (no dock)
 *   app/api              route handlers (not pages)
 *
 * These tests pin that structure so a new page can not silently end up outside it.
 */
const APP_DIR = path.resolve(__dirname, '../../src/app');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const rel = (file: string) => path.relative(APP_DIR, file).split(path.sep).join('/');
const pages = walk(APP_DIR)
  .filter((f) => /(^|[\\/])page\.tsx$/.test(f))
  .map(rel)
  .filter((p) => !p.startsWith('api/'));
const read = (p: string) => fs.readFileSync(path.join(APP_DIR, p), 'utf8');

describe('app router groups', () => {
  it('every page lives in (public) or (authenticate)', () => {
    expect(pages.length).toBeGreaterThan(10);
    const stray = pages.filter((p) => !p.startsWith('(public)/') && !p.startsWith('(authenticate)/'));
    expect(stray).toEqual([]);
  });

  it('(public) contains exactly the pages that must work without logging in', () => {
    const publicPages = pages.filter((p) => p.startsWith('(public)/')).sort();
    expect(publicPages).toEqual(['(public)/activate/page.tsx', '(public)/invite/page.tsx', '(public)/login/page.tsx']);
  });

  it('the pages that need a session are all under (authenticate)', () => {
    const mustBeAuthenticated = [
      'papers/page.tsx',
      'permissions/page.tsx',
      'account/page.tsx',
      'settings/page.tsx',
      'templates/page.tsx',
    ];
    for (const page of mustBeAuthenticated) {
      expect(pages.some((p) => p.startsWith('(authenticate)/') && p.endsWith(page))).toBe(true);
    }
  });

  it('focused workspaces (editor, template builders) are authenticated but outside the dock layout', () => {
    expect(pages).toContain('(authenticate)/(workspace)/papers/[id]/page.tsx');
    expect(pages).toContain('(authenticate)/(workspace)/templates/builder/page.tsx');
    expect(pages).toContain('(authenticate)/(workspace)/templates/journal/[id]/page.tsx');
    // ...and the list pages keep the dock
    expect(pages).toContain('(authenticate)/(main)/papers/page.tsx');
    expect(pages).toContain('(authenticate)/(main)/templates/page.tsx');
  });

  it('public pages never show the dock and never run the session check', () => {
    const publicLayout = read('(public)/layout.tsx');
    expect(publicLayout).not.toMatch(/Sidebar|BottomNav|AuthGuard|useAuth/);

    for (const page of ['(public)/login/page.tsx', '(public)/activate/page.tsx']) {
      expect(read(page)).not.toMatch(/Sidebar|BottomNav|AuthGuard/);
    }
  });

  it('the session check is applied once, by the (authenticate) layout', () => {
    expect(read('(authenticate)/layout.tsx')).toContain('AuthGuard');
    expect(read('layout.tsx')).not.toMatch(/AuthGuard|Sidebar|BottomNav/);
  });

  it('only the (main) layout renders the dock', () => {
    const main = read('(authenticate)/(main)/layout.tsx');
    expect(main).toContain('Sidebar');
    expect(main).toContain('BottomNav');
    expect(read('(authenticate)/(workspace)/layout.tsx')).not.toMatch(/Sidebar|BottomNav/);
  });

  it('the old path-sniffing AppShell is gone (no per-pathname special cases)', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../../src/components/layout/AppShell.tsx'))).toBe(false);
    const sources = walk(path.resolve(__dirname, '../../src'))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('AppShell'));
    expect(sources.map((f) => path.relative(path.resolve(__dirname, '../../src'), f))).toEqual([]);
  });

  it('no page was left behind at the old locations', () => {
    for (const old of ['login', 'activate', 'invite', 'permissions', 'account', 'papers/[id]', 'templates/builder']) {
      expect(fs.existsSync(path.join(APP_DIR, old, 'page.tsx'))).toBe(false);
    }
    expect(fs.existsSync(path.join(APP_DIR, 'page.tsx'))).toBe(false);
  });
});
