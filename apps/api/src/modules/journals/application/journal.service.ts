import { Injectable, Inject, Optional, NotFoundException } from '@nestjs/common';
import { journals, eq, type DbClient } from '@structpaper/db';
import {
  ALL_JOURNAL_IDS,
  JOURNAL_DEFINITIONS,
  resolveProfile,
  getJournalProfile,
  ALL_ARTICLE_TYPES,
  ARTICLE_TYPE_DEFINITIONS,
} from '@structpaper/journal-profiles';

export interface JournalDto {
  id: string;
  slug: string;
  code: string;
  name: string;
  shortName: string;
  issn: string | null;
  color: string;
  status: string;
  articleTypes: string[];
  latexCls?: string;
  version: number;
}

@Injectable()
export class JournalService {
  constructor(
    @Optional()
    @Inject('DB_CLIENT')
    private readonly db?: DbClient,
  ) {}

  /**
   * Lists all available scientific journals with article types and styling parameters.
   */
  async listJournals(): Promise<JournalDto[]> {
    if (this.db) {
      try {
        const rows = await this.db.select().from(journals);
        if (rows && rows.length > 0) {
          return rows.map((r) => this.mapToDto(r));
        }
      } catch (err: any) {
        // Fallback to built-ins if DB query fails
      }
    }

    return this.getBuiltInJournals();
  }

  /**
   * Retrieves a single journal by UUID or slug (e.g. 'vnuhcm-hs' or 'hs').
   */
  async getJournalById(idOrSlug: string): Promise<JournalDto> {
    const normalized = idOrSlug.trim().toLowerCase();

    if (this.db) {
      try {
        const bySlug = await this.db
          .select()
          .from(journals)
          .where(eq(journals.slug, normalized))
          .limit(1);

        if (bySlug && bySlug.length > 0) {
          return this.mapToDto(bySlug[0]);
        }

        // Try UUID match if valid uuid
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized);
        if (isUuid) {
          const byId = await this.db
            .select()
            .from(journals)
            .where(eq(journals.id, normalized))
            .limit(1);

          if (byId && byId.length > 0) {
            return this.mapToDto(byId[0]);
          }
        }
      } catch {
        // Fallback to in-memory definitions
      }
    }

    // Fallback: check built-ins
    const builtIns = this.getBuiltInJournals();
    const match = builtIns.find(
      (j) =>
        j.slug === normalized ||
        j.id === normalized ||
        j.code.toLowerCase() === normalized ||
        j.shortName.toLowerCase() === normalized,
    );

    if (match) return match;

    throw new NotFoundException(`Journal with identifier '${idOrSlug}' not found.`);
  }

  /**
   * Retrieves allowed article types for a given journal.
   */
  async getArticleTypes(idOrSlug: string): Promise<any[]> {
    const journal = await this.getJournalById(idOrSlug);
    const allowedTypeKeys = journal.articleTypes || ['research', 'review'];

    return ALL_ARTICLE_TYPES.filter((t) => allowedTypeKeys.includes(t.id)).map((t) => ({
      id: t.id,
      label: t.label,
      requiredSections: t.requiredSections,
      definition: ARTICLE_TYPE_DEFINITIONS[t.id] || null,
    }));
  }

  /**
   * Resolves 3-tier styling profile for a journal and optional article type.
   */
  async resolveProfile(journalIdOrSlug: string, articleType?: string): Promise<any> {
    const journal = await this.getJournalById(journalIdOrSlug);
    const slugKey = journal.shortName.toLowerCase();

    try {
      return resolveProfile(slugKey);
    } catch {
      return getJournalProfile(slugKey);
    }
  }

  private mapToDto(row: any): JournalDto {
    const settings = row.settings || {};
    return {
      id: row.id,
      slug: row.slug,
      code: settings.code || `VNUHCM-${row.slug.toUpperCase()}`,
      name: row.name,
      shortName: settings.shortName || row.slug.replace('vnuhcm-', '').toUpperCase(),
      issn: row.issn || null,
      color: settings.color || '#000099',
      status: row.status || 'published',
      articleTypes: settings.articleTypes || ['research', 'review'],
      latexCls: settings.latexCls || undefined,
      version: row.version || 1,
    };
  }

  private getBuiltInJournals(): JournalDto[] {
    return ALL_JOURNAL_IDS.map((jid) => {
      const def = JOURNAL_DEFINITIONS[jid];
      const shortName = jid.toUpperCase();
      return {
        id: jid,
        slug: `vnuhcm-${jid}`,
        code: def.names?.short || `VNUHCM-${shortName}`,
        name: def.names?.vi || `Tạp chí ĐHQG-HCM (${shortName})`,
        shortName,
        issn: this.getBuiltInIssn(jid),
        color: def.color || '#000099',
        status: jid === 'arns' ? 'draft' : 'published',
        articleTypes: ['research', 'review', 'commentary'],
        latexCls: def.latex?.cls || `structpaper-${jid}.cls`,
        version: 1,
      };
    });
  }

  private getBuiltInIssn(jid: string): string {
    const map: Record<string, string> = {
      std: '1859-0128',
      hs: '2734-9330',
      ssh: '2734-9349',
      ebl: '2734-9357',
      et: '2734-9365',
      ees: '2734-9373',
      arns: '2734-9381',
    };
    return map[jid] || '1859-0128';
  }
}
