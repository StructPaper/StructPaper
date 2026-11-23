import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { ManuscriptSourceService } from '../../src/modules/manuscripts/application/manuscript-source.service';

const factory = new AbilityFactory();
const M = '11111111-2222-3333-4444-555555555555';
const row = (generalAccess = 'RESTRICTED') => ({ id: M, createdBy: 'owner', status: 'DRAFT', generalAccess, journalId: 'j' });
const db = (manuscript: any) => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => (manuscript ? [manuscript] : []) }) }) }),
});

/** In-memory object store. */
function memoryStorage() {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    putObject: async (k: string, b: Buffer) => void objects.set(k, b),
    getObjectBuffer: async (k: string) => objects.get(k) ?? null,
    headObject: async (k: string) => (objects.has(k) ? { contentLength: objects.get(k)!.length } : null),
  } as any;
}

const as = (role?: string) =>
  factory.createForUser('u-1', { roles: [{ name: 'Author' }], manuscriptMemberships: role ? [{ manuscriptId: M, role }] : [] });
const guest = () => factory.createForUser({ roles: [], manuscriptMemberships: [] });
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml')]);
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

describe('Manuscript source (the Word file a paper was imported from)', () => {
  it('an editor stores the file with its hash, name and importer version; readers see them', async () => {
    const st = memoryStorage();
    const svc = new ManuscriptSourceService(db(row()), st);

    const info = await svc.saveFile(M, DOCX, { fileName: 'bài báo.docx', sha256: sha(DOCX), importerVersion: 3 }, await as('COAUTHOR'), 'u-1');
    expect(info).toMatchObject({ fileName: 'bài báo.docx', sha256: sha(DOCX), size: DOCX.length, importerVersion: 3, hasBaseline: false });
    expect(st.objects.get(`sources/${M}/source.docx`)).toBe(DOCX);

    expect(await svc.info(M, await as('VIEWER'))).toMatchObject({ fileName: 'bài báo.docx', importerVersion: 3 });
    expect((await svc.readFile(M, await as('VIEWER'))).buffer).toBe(DOCX);
  });

  it('keeps the first reading apart, and a newer importer version replaces the stored one', async () => {
    const st = memoryStorage();
    const svc = new ManuscriptSourceService(db(row()), st);
    await svc.saveFile(M, DOCX, { fileName: 'a.docx', importerVersion: 1 }, await as('OWNER'));

    const baseline = { metadata: { title: 'T' }, sections: [{ id: 's_1', type: 'paragraph', content: 'x' }] };
    expect(await svc.saveBaseline(M, baseline, 2, await as('OWNER'))).toMatchObject({ hasBaseline: true, importerVersion: 2 });
    expect(await svc.readBaseline(M, await as('VIEWER'))).toEqual(baseline);
    // the paper's own data is untouched: only sources/<id>/* keys were written
    expect([...st.objects.keys()].every((k) => k.startsWith(`sources/${M}/`))).toBe(true);
  });

  it('is limited like the paper: a reader or stranger can not store; a guest reads only when the paper is shared', async () => {
    const svc = new ManuscriptSourceService(db(row()), memoryStorage());
    await expect(svc.saveFile(M, DOCX, { importerVersion: 1 }, await as('VIEWER'))).rejects.toThrow(ForbiddenException);
    await expect(svc.saveFile(M, DOCX, { importerVersion: 1 }, await as())).rejects.toThrow(ForbiddenException);
    await expect(svc.info(M, await guest())).rejects.toThrow(ForbiddenException);

    const shared = new ManuscriptSourceService(db(row('VIEWER')), memoryStorage());
    expect(await shared.info(M, await guest())).toBeNull();
  });

  it('refuses what is not a .docx, a wrong checksum and a bad version', async () => {
    const svc = new ManuscriptSourceService(db(row()), memoryStorage());
    const owner = await as('OWNER');
    await expect(svc.saveFile(M, Buffer.from('plain text'), { importerVersion: 1 }, owner)).rejects.toThrow(BadRequestException);
    await expect(svc.saveFile(M, { not: 'a buffer' }, { importerVersion: 1 }, owner)).rejects.toThrow(BadRequestException);
    await expect(svc.saveFile(M, DOCX, { sha256: 'deadbeef', importerVersion: 1 }, owner)).rejects.toThrow(BadRequestException);
    await expect(svc.saveFile(M, DOCX, { importerVersion: NaN }, owner)).rejects.toThrow(BadRequestException);
  });

  it('404 for a paper with no file or no first reading', async () => {
    const svc = new ManuscriptSourceService(db(row('VIEWER')), memoryStorage());
    expect(await svc.info(M, await guest())).toBeNull();
    await expect(svc.readFile(M, await guest())).rejects.toThrow(NotFoundException);
    await expect(svc.readBaseline(M, await guest())).rejects.toThrow(NotFoundException);
    await expect(svc.saveBaseline(M, { sections: [] }, 1, await as('OWNER'))).rejects.toThrow(NotFoundException);
  });
});
