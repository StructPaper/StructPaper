import type { DocLike } from './doc-diff';

/**
 * A paper is kept in `manuscripts.metadata` in one of two shapes, and the history has to read and write both:
 *  - wrapped: `{ doc: <the paper> }` (older saves, and the sync client);
 *  - flat: the paper's metadata fields with `sections`, `references`, `layoutSettings`, `displayName`, `templateId`,
 *    `templateName` beside them (what the app writes when it saves straight to the server).
 */
type Json = Record<string, any>;

/** Keys of the flat shape that are not part of the paper's own metadata. */
const FLAT_EXTRA = new Set(['doc', 'displayName', 'sections', 'references', 'layoutSettings', 'templateId', 'templateName']);

export const isWrapped = (stored: unknown): boolean => !!stored && typeof stored === 'object' && typeof (stored as Json).doc === 'object' && (stored as Json).doc !== null;

/** The paper as the editor sees it, whichever shape it is stored in. Empty stored data gives an empty paper. */
export function docFromStored(stored: Json | null | undefined): DocLike {
  if (!stored || typeof stored !== 'object') return { metadata: {}, sections: [], references: [] };
  if (isWrapped(stored)) return stored.doc as DocLike;
  const metadata: Json = {};
  for (const [key, value] of Object.entries(stored)) if (!FLAT_EXTRA.has(key)) metadata[key] = value;
  return {
    metadata,
    sections: Array.isArray(stored.sections) ? stored.sections : [],
    references: Array.isArray(stored.references) ? stored.references : [],
    layoutSettings: stored.layoutSettings,
    displayName: stored.displayName,
  };
}

/**
 * What to store for `doc`, in the same shape as `existing` (so the app keeps reading it the way it wrote it).
 * The result replaces the stored metadata whole; it keeps what in `existing` is not part of the paper (template ids...).
 */
export function storedFromDoc(doc: DocLike, existing: Json | null | undefined): Json {
  const base = existing && typeof existing === 'object' ? existing : {};
  if (isWrapped(base)) return { ...base, doc };
  const out: Json = { ...(doc.metadata ?? {}) };
  if (doc.displayName !== undefined) out.displayName = doc.displayName;
  out.sections = doc.sections ?? [];
  out.references = doc.references ?? [];
  if (doc.layoutSettings !== undefined) out.layoutSettings = doc.layoutSettings;
  if (base.templateId !== undefined) out.templateId = base.templateId;
  if (base.templateName !== undefined) out.templateName = base.templateName;
  return out;
}
