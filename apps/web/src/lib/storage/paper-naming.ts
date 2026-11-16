import type { ManuscriptRecord } from '@structpaper/doc-model';
import { getUnifiedStorage } from './storage-factory';

/**
 * Extracts a normalized, readable title from a Manuscript doc or returns empty string.
 */
export function extractDocTitle(doc: any): string {
  if (!doc) return '';
  if (Array.isArray(doc.meta?.title)) {
    return doc.meta.title
      .map((item: any) => (typeof item === 'string' ? item : item?.v || item?.text || ''))
      .join('')
      .trim();
  }
  if (typeof doc.metadata?.title === 'string') {
    return doc.metadata.title.trim();
  }
  return '';
}

/**
 * Extracts all titles (both displayName and manuscript title) from existing records.
 */
export function collectAllExistingTitles(records: ManuscriptRecord[], excludeId?: string): string[] {
  const titles: string[] = [];
  for (const r of records) {
    if (excludeId && r.info.id === excludeId) continue;
    if (r.info.archived) continue;

    if (r.info.displayName && r.info.displayName.trim()) {
      titles.push(r.info.displayName.trim());
    }
    const docT = extractDocTitle(r.doc);
    if (docT && docT.trim()) {
      titles.push(docT.trim());
    }
  }
  return titles;
}

/**
 * Given a base title, checks if it or its root is taken in the list of existing titles.
 * Generates next unique title with suffix (1), (2), etc.
 */
export function getUniquePaperTitle(baseTitle: string, existingTitles: string[]): string {
  const trimmed = baseTitle.trim() || 'Bản thảo bài báo';
  const existingSet = new Set(existingTitles.map((t) => t.trim().toLowerCase()));

  if (!existingSet.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  // Parse root name if already has suffix like "Title (1)"
  const match = trimmed.match(/^(.*?)(?:\s*\((\d+)\))?$/);
  const root = match && match[1] && match[1].trim() ? match[1].trim() : trimmed;
  let counter = match && match[2] ? parseInt(match[2], 10) + 1 : 1;

  while (existingSet.has(`${root} (${counter})`.toLowerCase())) {
    counter++;
  }

  return `${root} (${counter})`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Counts how many existing papers match targetTitle (case-insensitive) either as exact title
 * or as root variant "targetTitle (N)".
 */
export function countDuplicatePapers(targetTitle: string, records: ManuscriptRecord[], excludeId?: string): number {
  const trimmed = targetTitle.trim();
  if (!trimmed) return 0;

  // Root without any trailing (number)
  const match = trimmed.match(/^(.*?)(?:\s*\((\d+)\))?$/);
  const root = match && match[1] && match[1].trim() ? match[1].trim() : trimmed;
  const pattern = new RegExp(`^${escapeRegex(root)}(\\s*\\(\\d+\\))?$`, 'i');

  let count = 0;
  for (const r of records) {
    if (excludeId && r.info.id === excludeId) continue;
    if (r.info.archived) continue;

    const disp = r.info.displayName?.trim();
    const docT = extractDocTitle(r.doc)?.trim();

    const dispMatch = disp ? pattern.test(disp) : false;
    const docTMatch = docT ? pattern.test(docT) : false;

    if (dispMatch || docTMatch) {
      count++;
    }
  }
  return count;
}

/**
 * Checks if a paper title has duplicates in IndexedDB.
 * Returns the count of existing matching papers and the auto-suggested unique title with (1), (2)...
 */
export async function checkPaperTitleDuplicate(
  targetTitle: string,
  excludeId?: string
): Promise<{ count: number; uniqueTitle: string }> {
  try {
    const records = await getUnifiedStorage().listRecords();
    const count = countDuplicatePapers(targetTitle, records, excludeId);
    const allTitles = collectAllExistingTitles(records, excludeId);
    const uniqueTitle = getUniquePaperTitle(targetTitle, allTitles);
    return { count, uniqueTitle };
  } catch (err) {
    console.warn('[paper-naming] Error checking duplicates:', err);
    return { count: 0, uniqueTitle: targetTitle.trim() || 'Bản thảo bài báo' };
  }
}

/**
 * Validates whether a target display name conflicts with any existing paper (either its displayName or doc title)
 * in storage, excluding the paper with excludeId.
 */
export async function validateDisplayNameUniqueness(
  excludeId: string,
  targetDisplayName: string
): Promise<{ isDuplicate: boolean; duplicateSubmissionId?: string }> {
  try {
    const allRecords = await getUnifiedStorage().listRecords();
    const target = targetDisplayName.trim().toLowerCase();
    const duplicate = allRecords.find((r) => {
      if (r.info.id === excludeId || r.info.archived) return false;
      const disp = r.info.displayName?.trim().toLowerCase();
      const docT = extractDocTitle(r.doc)?.trim().toLowerCase();
      return disp === target || docT === target;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        duplicateSubmissionId: duplicate.info.submissionId || duplicate.info.id.slice(0, 8),
      };
    }
    return { isDuplicate: false };
  } catch (err) {
    console.warn('[paper-naming] Error validating display name uniqueness:', err);
    return { isDuplicate: false };
  }
}
