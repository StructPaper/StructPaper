import { Injectable, Inject, Optional, NotFoundException } from '@nestjs/common';
import {
  journals,
  articleTypes,
  eq,
  asc,
  VNUHCM_DEFAULT_JOURNALS,
  type DbClient,
  type Journal,
} from '@structpaper/db';

export interface JournalDto {
  id: string;
  slug: string;
  code: string;
  name: string;
  nameEn: string | null;
  shortName: string;
  issn: string | null;
  color: string;
  status: string;
  sortOrder: number;
  /** Codes of the article types the journal accepts, in order. */
  articleTypes: string[];
  latexCls?: string;
  version: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads of the journal catalogue. The database is the source; the seed's definitions only stand in when it is unreachable. */
@Injectable()
export class JournalService {
  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db?: DbClient,
  ) {}

  /** All journals, in the order the admins set. */
  async listJournals(): Promise<JournalDto[]> {
    if (this.db) {
      try {
        const rows = await this.db.select().from(journals).orderBy(asc(journals.sortOrder), asc(journals.slug));
        if (rows && rows.length > 0) {
          const types = await this.activeTypeCodes();
          return rows.map((r) => this.mapToDto(r, types.get(r.id) ?? []));
        }
      } catch {
        // fall back to the built-ins when the query fails
      }
    }
    return this.getBuiltInJournals();
  }

  /** Retrieves a single journal by UUID, slug or key (e.g. 'vnuhcm-hs' or 'hs'). */
  async getJournalById(idOrSlug: string): Promise<JournalDto> {
    const row = await this.findRow(idOrSlug);
    if (row) return this.mapToDto(row, (await this.activeTypeCodes(row.id)).get(row.id) ?? []);

    const normalized = idOrSlug.trim().toLowerCase();
    const match = this.getBuiltInJournals().find(
      (j) =>
        j.slug === normalized ||
        j.id === normalized ||
        j.code.toLowerCase() === normalized ||
        j.shortName.toLowerCase() === normalized,
    );
    if (match) return match;

    throw new NotFoundException(`Journal with identifier '${idOrSlug}' not found.`);
  }

  /** The database row by UUID, slug or short key ("hs"); undefined when there is no database or no match. */
  async findRow(idOrSlug: string): Promise<Journal | undefined> {
    if (!this.db) return undefined;
    const normalized = idOrSlug.trim().toLowerCase();
    const slugs = normalized.startsWith('vnuhcm-') ? [normalized] : [normalized, `vnuhcm-${normalized}`];
    try {
      for (const slug of slugs) {
        const [bySlug] = await this.db.select().from(journals).where(eq(journals.slug, slug)).limit(1);
        if (bySlug) return bySlug;
      }
      if (UUID.test(normalized)) {
        const [byId] = await this.db.select().from(journals).where(eq(journals.id, normalized)).limit(1);
        if (byId) return byId;
      }
    } catch {
      // treated as "not in the database"
    }
    return undefined;
  }

  mapToDto(row: Journal, articleTypeCodes: string[]): JournalDto {
    return {
      id: row.id,
      slug: row.slug,
      code: row.code,
      name: row.name,
      nameEn: row.nameEn || null,
      shortName: row.shortName,
      issn: row.issn || null,
      color: row.color,
      status: row.status,
      sortOrder: row.sortOrder,
      articleTypes: articleTypeCodes,
      latexCls: row.latexCls,
      version: row.version,
    };
  }

  /** journal id -> codes of its active article types, in order (all journals, or just one). */
  private async activeTypeCodes(journalId?: string): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!this.db) return out;
    const rows = await this.db
      .select({ journalId: articleTypes.journalId, code: articleTypes.code, status: articleTypes.status })
      .from(articleTypes)
      .where(journalId ? eq(articleTypes.journalId, journalId) : undefined)
      .orderBy(asc(articleTypes.sortOrder), asc(articleTypes.code));
    for (const r of rows) {
      if (r.status !== 'active') continue;
      out.set(r.journalId, [...(out.get(r.journalId) ?? []), r.code]);
    }
    return out;
  }

  private getBuiltInJournals(): JournalDto[] {
    return VNUHCM_DEFAULT_JOURNALS.map((j) => ({
      id: j.slug.replace(/^vnuhcm-/, ''),
      slug: j.slug,
      code: j.code,
      name: j.name,
      nameEn: j.nameEn,
      shortName: j.shortName,
      issn: j.issn,
      color: j.color,
      status: j.status,
      sortOrder: j.sortOrder,
      articleTypes: j.articleTypes,
      latexCls: j.latexCls,
      version: 1,
    }));
  }
}
