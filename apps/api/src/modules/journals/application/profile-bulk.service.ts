import crypto from 'crypto';
import {
  Injectable,
  Inject,
  Optional,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import {
  manuscripts,
  manuscriptProfileSnapshots,
  articleTypes,
  users,
  auditLogs,
  eq,
  inArray,
  type DbClient,
} from '@structpaper/db';
import type { ApplyProfileToPapersResult } from '@structpaper/contracts';
import type { AppAbility } from '../../access/domain/ability.factory';
import { PasswordService } from '../../identity/domain/password.service';
import { JournalService } from './journal.service';
import { ProfileResolveService } from './profile-resolve.service';
import { RevisionService } from '../../manuscripts/application/revision.service';

const KEYS = ['base', 'journal', 'articleType'] as const;

/**
 * Moves every paper of a journal to the rules that are published now. Papers never move on their own (each is pinned),
 * so this is the one deliberate way to do it for all of them at once. It cannot be undone, hence the password.
 */
@Injectable()
export class ProfileBulkService {
  constructor(
    @Inject(JournalService) private readonly journals: JournalService,
    @Inject(ProfileResolveService) private readonly resolver: ProfileResolveService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Optional() @Inject('DRIZZLE') private readonly db?: DbClient,
    @Optional() @Inject(RevisionService) private readonly revisions?: RevisionService,
  ) {}

  async applyToAllPapers(
    idOrSlug: string,
    password: string,
    ability: AppAbility,
    userId?: string,
  ): Promise<ApplyProfileToPapersResult> {
    if (!this.db) throw new ServiceUnavailableException('Moving papers to the newest rules needs the database');
    const db = this.db;

    const journal = await this.journals.findRow(idOrSlug);
    if (!journal) throw new NotFoundException(`Journal ${idOrSlug} not found`);
    if (!ability.can('update', subject('Journal', journal as any))) {
      throw new ForbiddenException('You may not change the rules of this journal');
    }

    // 403, not 401: a wrong password must not look like an expired session (the app would sign the user out)
    const [user] = userId ? await db.select().from(users).where(eq(users.id, userId)).limit(1) : [];
    if (!user?.passwordHash || !(await this.passwords.verify(user.passwordHash, password))) {
      throw new ForbiddenException('Incorrect password');
    }

    const papers = await db.select().from(manuscripts).where(eq(manuscripts.journalId, journal.id));
    const typeIds = [...new Set(papers.map((p) => p.articleTypeId).filter((v): v is string => Boolean(v)))];
    const typeRows = typeIds.length ? await db.select().from(articleTypes).where(inArray(articleTypes.id, typeIds)) : [];
    const codeById = new Map(typeRows.map((t) => [t.id, t.code]));

    // the newest rules are the same for every paper of one article type: work them out once per type
    const latest = new Map<string, Awaited<ReturnType<ProfileResolveService['pinFor']>>>();
    const latestFor = async (typeId: string | null) => {
      const key = typeId ?? '';
      if (!latest.has(key)) latest.set(key, await this.resolver.pinFor(journal, typeId ? codeById.get(typeId) : undefined));
      return latest.get(key)!;
    };

    // every paper that is about to move keeps a safety copy of what it is now (it cannot be undone in one step)
    if (this.revisions) {
      for (const paper of papers) {
        const next = await latestFor(paper.articleTypeId ?? null);
        const current = (paper.profilePin ?? {}) as Record<string, number | undefined>;
        if (!KEYS.every((k) => current[k] === (next.pin as any)[k])) {
          await this.revisions.snapshotCurrent(paper, 'profile-upgrade', 'Trước khi áp dụng quy tắc mới cho mọi bài', userId);
        }
      }
    }

    let updated = 0;
    let unchanged = 0;
    await db.transaction(async (tx: any) => {
      for (const paper of papers) {
        const next = await latestFor(paper.articleTypeId ?? null);
        const current = (paper.profilePin ?? {}) as Record<string, number | undefined>;
        if (KEYS.every((k) => current[k] === (next.pin as any)[k])) {
          unchanged++;
          continue;
        }
        await tx.update(manuscripts).set({ profilePin: next.pin, updatedAt: new Date() }).where(eq(manuscripts.id, paper.id));
        await tx.insert(manuscriptProfileSnapshots).values({
          manuscriptId: paper.id,
          pin: next.pin,
          resolved: next.resolved,
          hash: crypto.createHash('sha256').update(JSON.stringify(next.resolved)).digest('hex'),
          reason: 'profile_upgrade_all',
        });
        updated++;
      }
      await tx.insert(auditLogs).values({
        userId: userId ?? null,
        action: 'journal.apply_profile_to_papers',
        resourceType: 'journal',
        resourceId: journal.id,
        payload: { updated, unchanged },
      });
    });
    return { updated, unchanged };
  }
}
