import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { ManuscriptPreviewService } from '../../src/modules/manuscripts/application/manuscript-preview.service';

const factory = new AbilityFactory();
const M = '11111111-2222-3333-4444-555555555555';
const row = (generalAccess = 'RESTRICTED') => ({ id: M, createdBy: 'owner', status: 'DRAFT', generalAccess, journalId: 'j' });

const db = (manuscript: any) => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => (manuscript ? [manuscript] : []) }) }) }),
});
const storage = (stored: Buffer | null = null) =>
  ({ putObject: vi.fn().mockResolvedValue(undefined), getObjectBuffer: vi.fn().mockResolvedValue(stored) }) as any;

const as = (role?: string) =>
  factory.createForUser('u-1', { roles: [{ name: 'Author' }], manuscriptMemberships: role ? [{ manuscriptId: M, role }] : [] });
const guest = () => factory.createForUser({ roles: [], manuscriptMemberships: [] });
const PDF = Buffer.from('%PDF-1.5 test');

describe('Manuscript preview (latest compiled PDF)', () => {
  it('an editor of the paper stores it, under a fixed key', async () => {
    const st = storage();
    const svc = new ManuscriptPreviewService(db(row()), st);

    await expect(svc.save(M, PDF, await as('COAUTHOR'))).resolves.toEqual({ success: true });
    expect(st.putObject).toHaveBeenCalledWith(`previews/${M}.pdf`, PDF, 'application/pdf');
  });

  it('a reader or a stranger can not store one; garbage is refused', async () => {
    const svc = new ManuscriptPreviewService(db(row()), storage());

    await expect(svc.save(M, PDF, await as('VIEWER'))).rejects.toThrow(ForbiddenException);
    await expect(svc.save(M, PDF, await as())).rejects.toThrow(ForbiddenException);
    await expect(svc.save(M, Buffer.from('not a pdf'), await as('OWNER'))).rejects.toThrow(BadRequestException);
    await expect(svc.save(M, { not: 'a buffer' }, await as('OWNER'))).rejects.toThrow(BadRequestException);
  });

  it('every reader sees it; a guest only when the paper is shared with anyone', async () => {
    const shared = new ManuscriptPreviewService(db(row('VIEWER')), storage(PDF));
    expect(await shared.read(M, await guest())).toBe(PDF);
    expect(await shared.read(M, await as('VIEWER'))).toBe(PDF);

    const priv = new ManuscriptPreviewService(db(row()), storage(PDF));
    await expect(priv.read(M, await guest())).rejects.toThrow(ForbiddenException);
    expect(await priv.read(M, await as('REVIEWER'))).toBe(PDF);
  });

  it('404 while nobody has compiled it yet', async () => {
    const svc = new ManuscriptPreviewService(db(row('VIEWER')), storage(null));
    await expect(svc.read(M, await guest())).rejects.toThrow(NotFoundException);
  });
});
