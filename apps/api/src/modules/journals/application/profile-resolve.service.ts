import { Injectable, Inject, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  profileVersions,
  journals,
  articleTypes,
  eq,
  and,
  isNull,
  inArray,
  type DbClient,
  type Journal,
  type ArticleType,
  type ProfileVersion,
} from '@structpaper/db';
import type { ProfilePin } from '@structpaper/contracts';
import {
  ARTICLE_TYPE_DEFINITIONS,
  normalizeArticleTypeId,
  resolveFromTiers,
  type JournalTierProfile,
} from '@structpaper/journal-profiles';
import { JournalService } from './journal.service';
import {
  builtInArticleTier,
  builtInBase,
  builtInTier,
  journalKey,
  listArticleTypes,
  withIdentity,
  withTypeIdentity,
} from '../domain/profile-tiers';

export interface PublishedTier {
  version: number;
  config: Record<string, any>;
}

export interface PublishedProfiles {
  base: PublishedTier;
  /** journal key -> its rules, with the journal's identity and article type list laid over them */
  journals: Record<string, { version: number; config: JournalTierProfile }>;
  /** journal key -> article type code -> that type's rules (archived types too: old papers may use them) */
  articleTypes: Record<string, Record<string, PublishedTier>>;
  etag: string;
}

export interface ResolvedProfileResponse {
  profile: Record<string, any>;
  versions: { base: number; journal: number; articleType?: number };
  etag: string;
}

/** "base:1,journal:3,type:2": the profile versions a paper was written under. */
export function parsePin(raw?: string): ProfilePin | undefined {
  if (!raw) return undefined;
  const pin: ProfilePin = {};
  for (const part of raw.split(',')) {
    const [k, v] = part.split(':').map((s) => s.trim());
    const n = Number(v);
    const key = k === 'type' ? 'articleType' : k;
    if ((key !== 'base' && key !== 'journal' && key !== 'articleType') || !Number.isInteger(n) || n < 1) {
      throw new BadRequestException(`Bad pin '${raw}': expected like base:1,journal:3,type:2`);
    }
    pin[key] = n;
  }
  return pin;
}

const etagOf = (parts: unknown): string => `"${crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16)}"`;

/** What the client needs to lay a paper out: the published (or pinned) rules, merged exactly like the client merges them. */
@Injectable()
export class ProfileResolveService {
  constructor(
    @Inject(JournalService) private readonly journals_: JournalService,
    @Optional() @Inject('DRIZZLE') private readonly db?: DbClient,
  ) {}

  /** Every journal's published rules in one go: the app registers them once instead of asking per journal. */
  async getPublished(): Promise<PublishedProfiles> {
    if (!this.db) return { base: { version: 0, config: builtInBase() }, journals: {}, articleTypes: {}, etag: '"builtin"' };
    const [journalRows, typeRows, versions] = await Promise.all([
      this.db.select().from(journals),
      this.db.select().from(articleTypes),
      this.db.select().from(profileVersions).where(eq(profileVersions.state, 'published')),
    ]);

    const base = versions.find((v) => v.scopeType === 'base');
    const journalVersion = new Map(versions.filter((v) => v.scopeType === 'journal').map((v) => [v.journalId!, v]));
    const typeVersion = new Map(versions.filter((v) => v.scopeType === 'article_type').map((v) => [v.articleTypeId!, v]));

    const out: PublishedProfiles = {
      base: { version: base?.version ?? 0, config: base?.config ?? builtInBase() },
      journals: {},
      articleTypes: {},
      etag: '',
    };
    for (const journal of journalRows) {
      const jv = journalVersion.get(journal.id);
      if (!jv) continue;
      const key = journalKey(journal);
      const types = typeRows.filter((t) => t.journalId === journal.id);
      const configs = new Map([...typeVersion].filter(([id]) => types.some((t) => t.id === id)).map(([id, v]) => [id, v.config]));
      out.journals[key] = { version: jv.version, config: withIdentity(jv.config, journal, listArticleTypes(types, configs)) };
      out.articleTypes[key] = {};
      for (const type of types) {
        const tv = typeVersion.get(type.id);
        if (tv) out.articleTypes[key][type.code] = { version: tv.version, config: withTypeIdentity(tv.config, type) };
      }
    }
    out.etag = etagOf({
      b: out.base.version,
      j: Object.entries(out.journals).map(([k, v]) => [k, v.version, v.config.color, v.config.names, v.config.articleTypes]),
      t: Object.entries(out.articleTypes).map(([k, types]) => [k, Object.entries(types).map(([c, t]) => [c, t.version, t.config.label])]),
    });
    return out;
  }

  /** `pin` resolves the exact versions a paper was written under instead of the published ones. */
  async resolve(journalRef: string, typeCode?: string, pin?: ProfilePin): Promise<ResolvedProfileResponse> {
    const journal = await this.journals_.findRow(journalRef);
    if (!journal && this.db) throw new NotFoundException(`Journal '${journalRef}' not found`);

    const base = await this.tier({ scope: 'base' }, pin?.base);
    const key = journal ? journalKey(journal) : journalRef.replace(/^vnuhcm-/i, '').toLowerCase();
    const own = journal
      ? await this.tier({ scope: 'journal', journal }, pin?.journal)
      : { version: 0, config: builtInTier(key) as Record<string, any> };

    const types: ArticleType[] = journal && this.db ? await this.db.select().from(articleTypes).where(eq(articleTypes.journalId, journal.id)) : [];
    const listedConfigs = await this.publishedTypeConfigs(types.map((t) => t.id));

    let typeRow: ArticleType | undefined;
    let articleTier;
    let typeVersion: number | undefined;
    if (typeCode) {
      const code = normalizeArticleTypeId(typeCode);
      if (journal && this.db) {
        typeRow = types.find((t) => t.code === code);
        if (!typeRow) throw new BadRequestException(`Journal '${journalRef}' has no article type '${typeCode}'`);
        const t = await this.tier({ scope: 'article_type', journal, type: typeRow }, pin?.articleType);
        typeVersion = t.version;
        articleTier = withTypeIdentity(t.config, typeRow);
      } else {
        if (!ARTICLE_TYPE_DEFINITIONS[code]) throw new BadRequestException(`Unknown article type '${typeCode}'`);
        articleTier = builtInArticleTier(code);
        typeVersion = 0;
      }
    }

    const profile = resolveFromTiers({
      base: base.config,
      journal: journal ? withIdentity(own.config, journal, listArticleTypes(types, listedConfigs)) : (own.config as JournalTierProfile),
      articleType: articleTier,
    });
    const versions = { base: base.version, journal: own.version, ...(typeVersion !== undefined ? { articleType: typeVersion } : {}) };
    return {
      profile: profile as unknown as Record<string, any>,
      versions,
      etag: etagOf([versions, profile.color, profile.names, profile.articleTypes, typeCode ?? '']),
    };
  }

  /**
   * The pin a new paper gets: the versions the client asked for (it laid the paper out with them), else the
   * published ones. A type code the journal does not have is ignored, not an error.
   */
  async pinFor(
    journal: Journal,
    typeCode?: string,
    requested?: ProfilePin,
  ): Promise<{ pin: ProfilePin; resolved: Record<string, any>; articleTypeId?: string; articleType?: string }> {
    let code = typeCode ? normalizeArticleTypeId(typeCode) : undefined;
    let typeRow: ArticleType | undefined;
    if (code && this.db) {
      [typeRow] = await this.db.select().from(articleTypes).where(and(eq(articleTypes.journalId, journal.id), eq(articleTypes.code, code))).limit(1);
      if (!typeRow) code = undefined;
    }
    const { profile, versions } = await this.resolve(journal.slug, code, requested);
    const pin: ProfilePin = {
      ...(versions.base ? { base: versions.base } : {}),
      ...(versions.journal ? { journal: versions.journal } : {}),
      ...(versions.articleType ? { articleType: versions.articleType } : {}),
    };
    return { pin, resolved: profile, articleTypeId: typeRow?.id, articleType: typeRow?.code };
  }

  private async publishedTypeConfigs(typeIds: string[]): Promise<Map<string, Record<string, any>>> {
    const out = new Map<string, Record<string, any>>();
    if (!this.db || typeIds.length === 0) return out;
    const rows = await this.db.select().from(profileVersions)
      .where(and(inArray(profileVersions.articleTypeId, typeIds), eq(profileVersions.state, 'published')));
    for (const r of rows) if (r.articleTypeId) out.set(r.articleTypeId, r.config);
    return out;
  }

  /** The pinned version if given, else the published one; without a database, the code's own rules. */
  private async tier(
    target: { scope: 'base' } | { scope: 'journal'; journal: Journal } | { scope: 'article_type'; journal: Journal; type: ArticleType },
    pinned?: number,
  ): Promise<PublishedTier> {
    const fallback = (): PublishedTier => ({
      version: 0,
      config:
        target.scope === 'base' ? builtInBase()
        : target.scope === 'journal' ? builtInTier(journalKey(target.journal), target.journal)
        : builtInArticleTier(target.type.code, target.type.labels),
    });
    if (!this.db) return fallback();
    const scoped =
      target.scope === 'base' ? and(eq(profileVersions.scopeType, 'base'), isNull(profileVersions.journalId))
      : target.scope === 'journal' ? and(eq(profileVersions.scopeType, 'journal'), eq(profileVersions.journalId, target.journal.id))
      : and(eq(profileVersions.scopeType, 'article_type'), eq(profileVersions.articleTypeId, target.type.id));
    const [row]: ProfileVersion[] = await this.db.select().from(profileVersions)
      .where(and(scoped, pinned ? eq(profileVersions.version, pinned) : eq(profileVersions.state, 'published'))).limit(1);
    if (pinned && !row) throw new NotFoundException(`Profile ${target.scope} version ${pinned} not found`);
    return row ? { version: row.version, config: row.config } : fallback();
  }
}
