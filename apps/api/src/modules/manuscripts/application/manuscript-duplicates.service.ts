import { Injectable, Inject, Optional } from '@nestjs/common';
import { manuscripts, users, eq, ilike, asc } from '@structpaper/db';

export interface TitleDuplicate {
  title: string;
  /** Who uploaded it: display name, else the part of the email before "@". */
  uploaderName: string;
  uploadedAt: Date | string;
  /** The asking user uploaded it. */
  mine: boolean;
}

/** "Title (2)" -> "Title": the numbered copies the system adds count as the same paper. */
export const titleRoot = (title: string): string => title.trim().replace(/\s*\(\d+\)$/, '').trim();

const norm = (s: string) =>
  titleRoot(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Papers that carry the same title (ignoring case, accents and a trailing "(n)"), with who uploaded
 * them. Only names and dates are returned: not the paper, not its id, so nothing private leaks and
 * nothing can be opened from here.
 */
@Injectable()
export class ManuscriptDuplicatesService {
  constructor(@Optional() @Inject('DRIZZLE') private readonly db: any) {}

  async findByTitle(title: string, currentUserId?: string): Promise<TitleDuplicate[]> {
    const root = titleRoot(title);
    if (!root) return [];
    const escaped = root.replace(/[%_\\]/g, (c) => `\\${c}`);

    const rows = await this.db
      .select({
        title: manuscripts.title,
        createdAt: manuscripts.createdAt,
        createdBy: manuscripts.createdBy,
        displayName: users.displayName,
        email: users.email,
      })
      .from(manuscripts)
      .leftJoin(users, eq(manuscripts.createdBy, users.id))
      .where(ilike(manuscripts.title, `${escaped}%`))
      .orderBy(asc(manuscripts.createdAt))
      .limit(100);

    const wanted = norm(root);
    return rows
      .filter((r: any) => norm(r.title) === wanted)
      .map((r: any) => ({
        title: r.title,
        uploaderName: String(r.displayName ?? '').trim() || (r.email ? String(r.email).split('@')[0] : '') || 'Người dùng',
        uploadedAt: r.createdAt,
        mine: Boolean(currentUserId) && r.createdBy === currentUserId,
      }));
  }
}
