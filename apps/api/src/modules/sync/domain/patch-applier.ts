import * as crypto from 'node:crypto';
import { applyPatches, enablePatches, type Patch as ImmerPatch } from 'immer';
import type { Patch } from '@structpaper/contracts';

// Ensure Immer patch recording/application is enabled
enablePatches();

export interface ApplyPatchesResult {
  docTree: Record<string, any>;
  checksum: string;
}

/**
 * Deterministically stringifies any JavaScript object/array by recursively sorting keys,
 * ensuring identical documents always produce identical strings and SHA-256 hashes.
 */
export function canonicalJsonStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map(
        (k) =>
          JSON.stringify(k) + ':' + canonicalJsonStringify((val as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}

/**
 * Computes deterministic SHA-256 checksum of canonical JSON representation of document tree.
 */
export function computeDocChecksum(doc: any): string {
  const canonical = canonicalJsonStringify(doc);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Normalizes string path (RFC 6902 JSON Pointer, e.g. "/content/0") or array path to Immer format.
 */
function normalizePath(path: string | (string | number)[]): (string | number)[] {
  if (Array.isArray(path)) {
    return path.map((segment) =>
      typeof segment === 'string' && /^\d+$/.test(segment) ? Number(segment) : segment,
    );
  }
  if (typeof path === 'string') {
    if (!path || path === '/') return [];
    return path
      .replace(/^\//, '')
      .split('/')
      .filter((s) => s.length > 0)
      .map((segment) => {
        if (segment === '-') return '-';
        if (/^\d+$/.test(segment)) return Number(segment);
        return segment;
      });
  }
  return [];
}

export class PatchApplier {
  /**
   * Applies an array of RFC 6902 / Immer patches to docTree immutably,
   * returning the updated docTree and its deterministic SHA-256 checksum.
   */
  static apply(docTree: Record<string, any>, patches: Patch[]): ApplyPatchesResult {
    const base = docTree || { type: 'doc', content: [] };

    const immerPatches: ImmerPatch[] = patches.map((p) => {
      const normalizedPath = normalizePath(p.path);
      const op = p.op.toLowerCase() as 'add' | 'remove' | 'replace';
      return {
        op,
        path: normalizedPath,
        value: p.value,
      };
    });

    const nextDoc = applyPatches(base, immerPatches);
    const checksum = computeDocChecksum(nextDoc);

    return {
      docTree: nextDoc,
      checksum,
    };
  }

  /**
   * Calculates SHA-256 checksum for document.
   */
  static calculateChecksum(docTree: Record<string, any>): string {
    return computeDocChecksum(docTree);
  }
}
