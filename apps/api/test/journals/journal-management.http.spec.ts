/**
 * The journal-management HTTP surface against a REAL Postgres, with real tokens and the real guards.
 * Skipped unless TEST_DATABASE_URL points at a throwaway database (see journal-management.integration.spec.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { createDbClient, seedDatabase, journals, users, roles, userRoles, sql, eq } from '@structpaper/db';

const url = process.env.TEST_DATABASE_URL;
/** These specs TRUNCATE tables: never let TEST_DATABASE_URL point anywhere but this machine. */
const assertThrowaway = (u?: string) => {
  if (u && !/^postgres(ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)[:/]/.test(u)) {
    throw new Error('TEST_DATABASE_URL must point at a throwaway database on localhost');
  }
};
assertThrowaway(url);
if (url) process.env.DATABASE_URL = url; // read when the app's database provider is created

import { lockTestDatabase } from './db-lock';

describe.skipIf(!url)('journal management over HTTP (real database, real tokens)', () => {
  let app: NestFastifyApplication;
  let client: ReturnType<typeof createDbClient>['client'];
  const tokens: Record<string, string> = {};

  const call = (method: string, path: string, who?: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({
      method: method as any,
      url: `/api/v1${path}`,
      payload: payload as any,
      headers: { ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}), ...headers },
    });
  const json = (res: { body: string }) => JSON.parse(res.body);

  let release: () => Promise<void>;

  beforeAll(async () => {
    release = await lockTestDatabase(url!);
    const created = createDbClient(url!, { max: 4, onnotice: () => undefined });
    client = created.client;
    const db = created.db;
    await db.execute(sql`TRUNCATE profile_versions, journals, user_roles, users RESTART IDENTITY CASCADE`);
    await seedDatabase(db);

    // active users: a super admin, a manager of HS only, and an author
    const roleRows = await db.select().from(roles);
    const roleId = (name: string) => roleRows.find((r) => r.name === name)!.id;
    const [hs] = await db.select().from(journals).where(eq(journals.slug, 'vnuhcm-hs'));
    const make = async (email: string, role: string, scope?: string) => {
      const [u] = await db.insert(users).values({ email, displayName: email, status: 'ACTIVE', passwordHash: 'x', permissionsVersion: 1 }).returning();
      await db.insert(userRoles).values({ userId: u.id, roleId: roleId(role), scopeJournalId: scope ?? '00000000-0000-0000-0000-000000000000' });
      return u;
    };
    const admin = await make('admin@test.dev', 'SuperAdmin');
    const manager = await make('hs-manager@test.dev', 'JournalManager', hs.id);
    const author = await make('author@test.dev', 'Author');

    const { AppModule } = await import('../../src/app.module');
    const { Rfc9457ExceptionFilter } = await import('../../src/modules/platform/filters/rfc9457-exception.filter');
    const { TokenService } = await import('../../src/modules/identity/domain/token.service');
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalFilters(new Rfc9457ExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const tokenService = app.get(TokenService);
    for (const [name, u] of Object.entries({ admin, manager, author })) {
      tokens[name] = await tokenService.signAccessToken({ sub: u.id, pv: 1 });
    }
  });

  afterAll(async () => {
    await app?.close();
    await client?.end();
    await release?.();
  });

  it('the catalogue and the published rules are public and come from the database', async () => {
    const list = json(await call('GET', '/journals'));
    expect(list.filter((j: any) => j.status !== 'archived').map((j: any) => j.slug)).toEqual(
      ['std', 'hs', 'ssh', 'ebl', 'et', 'ees', 'arns'].map((k) => `vnuhcm-${k}`),
    );
    const published = await call('GET', '/profiles/published');
    expect(published.statusCode).toBe(200);
    expect(json(published).journals.hs.version).toBe(1);
    expect((await call('GET', '/profiles/published', undefined, undefined, { 'if-none-match': published.headers.etag as string })).statusCode).toBe(304);
  });

  it('only a manager may create a journal; the new one is then listed and resolvable', async () => {
    const body = { key: 'agr', name: 'Tạp chí Nông nghiệp', nameEn: 'Agriculture', code: 'vnuhcm-agr', color: '#228B22', status: 'published' };
    expect((await call('POST', '/journals', 'author', body)).statusCode).toBe(403);
    expect((await call('POST', '/journals', 'manager', body)).statusCode).toBe(403); // scoped to HS only
    expect((await call('POST', '/journals', 'admin', { ...body, color: 'green' })).statusCode).toBe(400);

    const created = await call('POST', '/journals', 'admin', body);
    expect(created.statusCode).toBe(201);
    expect(json(created)).toMatchObject({ slug: 'vnuhcm-agr', code: 'VNUHCM-AGR', status: 'published', version: 1 });
    expect((await call('POST', '/journals', 'admin', body)).statusCode).toBe(409);

    const resolved = await call('GET', '/profiles/resolve?journal=agr&type=research');
    expect(resolved.statusCode).toBe(200);
    expect(json(resolved)).toMatchObject({ id: 'agr', color: '#228B22' });
    expect(resolved.headers['x-profile-versions']).toBe('base:1,journal:1,type:1');
  });

  it('editing uses If-Match: stale -> 412, current -> 200 with the next ETag; a scoped manager edits only their journal', async () => {
    const got = await call('GET', '/journals/ssh');
    const etag = got.headers.etag as string;
    expect(etag).toBe(`"${json(got).version}"`);

    expect((await call('PATCH', '/journals/ssh', 'admin', { color: '#0000EE' }, { 'if-match': '"999"' })).statusCode).toBe(412);
    const ok = await call('PATCH', '/journals/ssh', 'admin', { color: '#0000EE' }, { 'if-match': etag });
    expect(ok.statusCode).toBe(200);
    expect(json(ok).color).toBe('#0000EE');
    expect(ok.headers.etag).toBe(`"${json(got).version + 1}"`);
    await call('PATCH', '/journals/ssh', 'admin', { color: '#0000FF' });

    expect((await call('PATCH', '/journals/hs', 'manager', { nameEn: 'Health Sciences' })).statusCode).toBe(200);
    expect((await call('PATCH', '/journals/et', 'manager', { nameEn: 'Hijack' })).statusCode).toBe(403);
    expect((await call('PATCH', '/journals/hs', 'author', { nameEn: 'x' })).statusCode).toBe(403);
    expect((await call('PATCH', '/journals/hs', 'admin', {})).statusCode).toBe(400);
  });

  it('draft -> validate -> publish -> rollback over HTTP, with pins and bad input refused', async () => {
    const versions = json(await call('GET', '/profiles/journal/ebl/versions', 'admin'));
    const config = { ...versions[0].config, layout: { ...versions[0].config.layout, columns: 3 } };

    expect((await call('POST', '/profiles/journal/ebl/drafts', 'author', { config })).statusCode).toBe(403);
    expect((await call('POST', '/profiles/galaxy/ebl/drafts', 'admin', { config })).statusCode).toBe(400);
    expect((await call('POST', '/profiles/journal/ebl/drafts', 'admin', {})).statusCode).toBe(400);

    const draft = await call('POST', '/profiles/journal/ebl/drafts', 'admin', { config, changeNote: 'ba cột' });
    expect(draft.statusCode).toBe(201);
    expect(json(draft)).toMatchObject({ version: 2, state: 'draft' });

    expect((await call('POST', '/profiles/journal/ebl/drafts/2/publish', 'admin', {})).statusCode).toBe(409);
    const checked = await call('POST', '/profiles/journal/ebl/drafts/2/validate', 'admin');
    expect(json(checked)).toMatchObject({ ok: true, version: { state: 'validated' } });
    const published = await call('POST', '/profiles/journal/ebl/drafts/2/publish', 'admin'); // no body at all
    expect(published.statusCode).toBe(200);
    expect(json(published)).toMatchObject({ version: 2, state: 'published' });

    expect(json(await call('GET', '/profiles/resolve?journal=ebl')).layout.columns).toBe(3);
    expect(json(await call('GET', '/profiles/resolve?journal=ebl&pin=journal:1')).layout.columns).toBe(2);
    expect((await call('GET', '/profiles/resolve?journal=ebl&pin=journal:9')).statusCode).toBe(404);

    const rolled = await call('POST', '/profiles/journal/ebl/rollback', 'admin', { toVersion: 1 });
    expect(rolled.statusCode).toBe(200);
    expect(json(rolled)).toMatchObject({ version: 3, state: 'published' });
    expect(json(await call('GET', '/profiles/resolve?journal=ebl')).layout.columns).toBe(2);
    expect((await call('POST', '/profiles/journal/ebl/rollback', 'admin', { toVersion: 2 })).statusCode).toBe(200); // 2 was published once: allowed
    expect((await call('POST', '/profiles/journal/ebl/rollback', 'admin', { toVersion: 0 })).statusCode).toBe(400);
  });

  it('the manager of HS may draft HS rules, not those of another journal or of the base', async () => {
    const hsVersions = json(await call('GET', '/profiles/journal/hs/versions', 'manager'));
    expect((await call('POST', '/profiles/journal/hs/drafts', 'manager', { config: hsVersions[0].config })).statusCode).toBe(201);
    expect((await call('POST', '/profiles/journal/et/drafts', 'manager', { config: {} })).statusCode).toBe(403);
    expect((await call('POST', '/profiles/base/base/drafts', 'manager', { config: {} })).statusCode).toBe(403);
  });

  it('article types: listed publicly, added and changed only by those who may edit the journal, validated at the door', async () => {
    const list = json(await call('GET', '/journals/hs/article-types'));
    expect(list.map((t: any) => t.code)).toEqual(['research', 'review', 'case-report']);
    expect(list[0]).toMatchObject({ labels: { vi: 'Bài báo nghiên cứu' }, status: 'active' });

    const body = { code: 'protocol', labels: { vi: 'Đề cương', en: 'Protocol' } };
    expect((await call('POST', '/journals/hs/article-types', undefined, body)).statusCode).toBe(401);
    expect((await call('POST', '/journals/hs/article-types', 'author', body)).statusCode).toBe(403);
    expect((await call('POST', '/journals/et/article-types', 'manager', body)).statusCode).toBe(403);
    expect((await call('POST', '/journals/hs/article-types', 'manager', { ...body, code: 'Bad Code!' })).statusCode).toBe(400);
    expect((await call('POST', '/journals/hs/article-types', 'manager', { code: 'protocol' })).statusCode).toBe(400);

    const created = await call('POST', '/journals/hs/article-types', 'manager', body);
    expect(created.statusCode).toBe(201);
    expect(json(created)).toMatchObject({ code: 'protocol', status: 'active' });
    expect((await call('POST', '/journals/hs/article-types', 'manager', body)).statusCode).toBe(409);

    const archived = await call('PATCH', '/journals/hs/article-types/protocol', 'manager', { status: 'archived' });
    expect(archived.statusCode).toBe(200);
    expect(json(await call('GET', '/journals/hs/article-types')).map((t: any) => t.code)).not.toContain('protocol');
    expect(json(await call('GET', '/journals/hs/article-types?includeArchived=true')).map((t: any) => t.code)).toContain('protocol');
    expect((await call('PATCH', '/journals/hs/article-types/protocol', 'manager', {})).statusCode).toBe(400);
    expect((await call('PATCH', '/journals/hs/article-types/nope', 'manager', { status: 'active' })).statusCode).toBe(404);
  });

  it('article type rules are addressed as <journal>:<code> and go through the same life', async () => {
    const versions = await call('GET', '/profiles/article_type/hs:research/versions', 'admin');
    expect(versions.statusCode).toBe(200);
    expect(json(versions)[0]).toMatchObject({ scope: 'article_type', version: 1, state: 'published' });
    expect((await call('GET', '/profiles/article_type/hs/versions', 'admin')).statusCode).toBe(400);
    expect((await call('POST', '/profiles/article_type/hs:research/drafts', 'author', { config: {} })).statusCode).toBe(403);
  });

  it('a new paper carries its pin and article type, and the pin can be moved by its editor only', async () => {
    const hs = json(await call('GET', '/journals/hs'));
    const created = await call('POST', '/manuscripts', 'admin', { journalId: hs.id, title: 'Pinned over HTTP', articleType: 'research', metadata: {} });
    expect(created.statusCode).toBe(201);
    const paper = json(created);
    expect(paper).toMatchObject({ articleType: 'research' });
    expect(paper.profilePin).toMatchObject({ base: 1 });
    expect(paper.profilePin.journal).toBeGreaterThan(0);

    const read = json(await call('GET', `/manuscripts/${paper.id}`, 'admin'));
    expect(read.profilePin).toEqual(paper.profilePin);
    expect(read.journal).toMatchObject({ code: 'VNUHCM-HS' });

    // the article type moves with the author's choice
    expect((await call('PUT', `/manuscripts/${paper.id}/article-type`, undefined, { articleType: 'review' })).statusCode).toBe(401);
    expect((await call('PUT', `/manuscripts/${paper.id}/article-type`, 'author', { articleType: 'review' })).statusCode).toBe(403);
    expect((await call('PUT', `/manuscripts/${paper.id}/article-type`, 'admin', { articleType: 'Bad Code!' })).statusCode).toBe(400);
    expect((await call('PUT', `/manuscripts/${paper.id}/article-type`, 'admin', {})).statusCode).toBe(400);
    expect((await call('PUT', `/manuscripts/${paper.id}/article-type`, 'admin', { articleType: 'galaxy' })).statusCode).toBe(400);
    const changed = await call('PUT', `/manuscripts/${paper.id}/article-type`, 'admin', { articleType: 'case-report' });
    expect(changed.statusCode).toBe(200);
    expect(json(changed)).toMatchObject({ changed: true, articleType: 'case-report' });
    expect(json(await call('GET', `/manuscripts/${paper.id}`, 'admin'))).toMatchObject({ articleType: 'case-report' });
    expect(json(await call('PUT', `/manuscripts/${paper.id}/article-type`, 'admin', { articleType: null }))).toMatchObject({ changed: true, articleType: null });

    expect((await call('POST', `/manuscripts/${paper.id}/profile/upgrade`, undefined)).statusCode).toBe(401);
    expect((await call('POST', `/manuscripts/${paper.id}/profile/upgrade`, 'author')).statusCode).toBe(403);
    const upgrade = await call('POST', `/manuscripts/${paper.id}/profile/upgrade`, 'admin');
    expect(upgrade.statusCode).toBe(200);
    expect(json(upgrade).profilePin).toBeDefined();
  });
});
