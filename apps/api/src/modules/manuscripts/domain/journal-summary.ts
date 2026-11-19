import type { Journal } from '@structpaper/db';

/** The slice of a journal a manuscript is shown with. */
export function journalSummary(j?: Pick<Journal, 'id' | 'slug' | 'code' | 'name' | 'shortName' | 'color'> | null) {
  if (!j) return undefined;
  return { id: j.id, slug: j.slug, code: j.code, name: j.name, shortName: j.shortName, color: j.color };
}
