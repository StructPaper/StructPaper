import { describe, it, expect } from 'vitest';
import {
  PatchApplier,
  canonicalJsonStringify,
  computeDocChecksum,
} from '../../src/modules/sync/domain/patch-applier';
import type { Patch } from '@structpaper/contracts';

describe('PatchApplier Domain Logic', () => {
  const initialDoc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        text: 'Initial text',
      },
    ],
  };

  it('applies Immer/RFC 6902 patches with array paths correctly', () => {
    const patches: Patch[] = [
      {
        op: 'replace',
        path: ['content', 0, 'text'],
        value: 'Updated text',
      },
    ];

    const result = PatchApplier.apply(initialDoc, patches);

    expect(result.docTree).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          text: 'Updated text',
        },
      ],
    });
    expect(result.checksum).toBeDefined();
    expect(result.checksum).toHaveLength(64);
  });

  it('normalizes string paths (JSON Pointer format) and applies patches', () => {
    const patches: Patch[] = [
      {
        op: 'add',
        path: '/content/-',
        value: { type: 'paragraph', text: 'Second paragraph' },
      },
    ];

    const result = PatchApplier.apply(initialDoc, patches);

    expect(result.docTree.content).toHaveLength(2);
    expect(result.docTree.content[1]).toEqual({
      type: 'paragraph',
      text: 'Second paragraph',
    });
  });

  it('applies remove operation to document tree', () => {
    const docWithTwo = {
      type: 'doc',
      content: [
        { type: 'paragraph', text: 'First' },
        { type: 'paragraph', text: 'Second' },
      ],
    };

    const patches: Patch[] = [
      {
        op: 'remove',
        path: ['content', 1],
      },
    ];

    const result = PatchApplier.apply(docWithTwo, patches);

    expect(result.docTree.content).toHaveLength(1);
    expect(result.docTree.content[0].text).toBe('First');
  });

  it('computes deterministic SHA-256 checksum independent of key ordering', () => {
    const objA = {
      title: 'Title',
      nested: { beta: 2, alpha: 1 },
      tags: ['a', 'b'],
    };

    const objB = {
      nested: { alpha: 1, beta: 2 },
      tags: ['a', 'b'],
      title: 'Title',
    };

    const checksumA = computeDocChecksum(objA);
    const checksumB = computeDocChecksum(objB);

    expect(checksumA).toBe(checksumB);
    expect(checksumA).toMatch(/^[a-f0-9]{64}$/);

    const canonicalA = canonicalJsonStringify(objA);
    const canonicalB = canonicalJsonStringify(objB);
    expect(canonicalA).toBe(canonicalB);
  });

  it('produces different checksum when content changes', () => {
    const docA = { type: 'doc', content: [{ text: 'Hello' }] };
    const docB = { type: 'doc', content: [{ text: 'World' }] };

    const checksumA = PatchApplier.calculateChecksum(docA);
    const checksumB = PatchApplier.calculateChecksum(docB);

    expect(checksumA).not.toBe(checksumB);
  });
});
