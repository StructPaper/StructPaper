/**
 * CommandBus Adapter for StructPaper Editor Tabs
 * 
 * Bridges React UI tab interactions to the @structpaper/editor-core CommandBus.
 * Supports both standalone React prop callbacks (onChange / onUpdatePaper)
 * and direct CommandBus dispatches for undo/redo and immutable document mutation.
 */

import React, { createContext, useContext } from 'react';
import { CommandBus, createManuscriptStore } from '@structpaper/editor-core';
import type { Manuscript } from '@structpaper/doc-model';
import { migrateV1toV2 } from '@structpaper/doc-model';
import { CompletePaper } from '@/types/paper';

export interface EditorCommandContextType {
  commandBus?: CommandBus;
  dispatch?: (command: { type: string; payload: unknown }) => void;
}

export const EditorCommandBusContext = createContext<EditorCommandContextType>({});

export function useEditorCommandBus(): EditorCommandContextType {
  return useContext(EditorCommandBusContext);
}

/**
 * Creates a CommandBus instance preloaded with a manuscript converted from CompletePaper.
 */
export function createPaperCommandBus(paper?: CompletePaper): CommandBus {
  if (paper) {
    try {
      const doc = migrateV1toV2(paper);
      const store = createManuscriptStore(doc);
      return new CommandBus(store);
    } catch (e) {
      console.warn('migrateV1toV2 fallback in createPaperCommandBus:', e);
    }
  }

  const initialDoc: Manuscript = {
    schemaVersion: 2,
    id: paper?.id || 'paper_default',
    lang: 'vi',
    journalId: paper?.metadata.journalId || 'vnuhcm-hs',
    articleType: paper?.metadata.articleType || 'Bài báo nghiên cứu',
    meta: {
      title: paper?.metadata.title
        ? [{ t: 'text', v: paper.metadata.title }]
        : [{ t: 'text', v: '' }],
      translations: paper?.metadata.titleEn
        ? { en: [{ t: 'text', v: paper.metadata.titleEn }] }
        : undefined,
      authors: (paper?.metadata.authors || []).map((a) => ({
        id: a.id,
        name: a.name,
        affiliationIds: (a.affiliationIds || []).map((id) => `aff_${id}`),
        email: a.email,
        isCorresponding: a.isCorresponding,
        orcid: a.orcid,
      })),
      affiliations: (paper?.metadata.affiliations || []).map((aff) => ({
        id: `aff_${aff.id}`,
        institution: aff.name,
      })),
      abstract: paper?.metadata.abstract
        ? [[{ t: 'text', v: paper.metadata.abstract }]]
        : [],
      keywords: paper?.metadata.keywords || [],
      dates: {
        received: paper?.metadata.dates?.received,
        revised: paper?.metadata.dates?.revised,
        accepted: paper?.metadata.dates?.accepted,
        published: paper?.metadata.dates?.published,
      },
      doi: paper?.metadata.doi,
    },
    body: [],
    back: [],
    references: (paper?.references || []).map((r) => ({
      id: String(r.id),
      raw: r.raw,
      doi: r.doi,
      parse: 'ok' as const,
    })),
    assets: {},
  };

  const store = createManuscriptStore(initialDoc);
  return new CommandBus(store);
}

// Re-export dispatcher modules
export * from './dispatchers/metadata-dispatchers';
export * from './dispatchers/authors-dispatchers';
export * from './dispatchers/references-dispatchers';
