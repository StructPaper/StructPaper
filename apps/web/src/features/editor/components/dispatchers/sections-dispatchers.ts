import { CommandBus } from '@structpaper/editor-core';
import type { Block } from '@structpaper/doc-model';
import { PaperSection } from '@/types/paper';
import { displayTextToInlines } from '../sections/TemporaryParagraphInput';

/**
 * Maps a PaperSection into a doc-model Block where applicable.
 */
function sectionToBlock(sec: PaperSection): Block {
  switch (sec.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        id: sec.id,
        content: displayTextToInlines(sec.content || ''),
      };
    case 'figure':
      return {
        type: 'figure',
        id: sec.id,
        assetId: sec.figure?.id || sec.id,
        caption: displayTextToInlines(sec.figure?.caption || sec.content || ''),
        layout: { isFullWidth: sec.figure?.isFullWidth ?? true },
      };
    case 'table':
      return {
        type: 'table',
        id: sec.id,
        caption: displayTextToInlines(sec.table?.caption || sec.content || ''),
        grid: [],
        headerRows: 1,
        layout: { isFullWidth: sec.table?.isFullWidth ?? true },
      };
    default:
      return {
        type: 'paragraph',
        id: sec.id,
        content: displayTextToInlines(sec.title || sec.content || ''),
      };
  }
}

/**
 * Dispatches a section/block insertion to the CommandBus and updates the section list.
 */
export function dispatchAddSection(
  bus: CommandBus | undefined,
  newSection: PaperSection,
  insertAfterIndex: number | undefined,
  onChange: (updated: PaperSection[]) => void,
  current: PaperSection[]
): PaperSection[] {
  const updated = [...current];
  if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0) {
    updated.splice(insertAfterIndex + 1, 0, newSection);
  } else {
    updated.push(newSection);
  }

  if (bus) {
    try {
      const block = sectionToBlock(newSection);
      const afterBlockId =
        typeof insertAfterIndex === 'number' && current[insertAfterIndex]
          ? current[insertAfterIndex].id
          : undefined;

      bus.dispatch({
        type: 'block/insert',
        payload: {
          block,
          afterBlockId,
          position: insertAfterIndex === undefined ? 'end' : undefined,
        },
      });
    } catch (e) {
      console.warn('CommandBus block/insert dispatch warning:', e);
    }
  }

  onChange(updated);
  return updated;
}

/**
 * Dispatches an update to an existing section/block to the CommandBus.
 */
export function dispatchUpdateSection(
  bus: CommandBus | undefined,
  index: number,
  updatedSection: PaperSection,
  onChange: (updated: PaperSection[]) => void,
  current: PaperSection[]
): PaperSection[] {
  const updated = [...current];
  updated[index] = updatedSection;

  if (bus) {
    try {
      const secId = updatedSection.id || `sec_${index}`;
      if (updatedSection.type === 'paragraph') {
        bus.dispatch({
          type: 'block/update',
          payload: {
            blockId: secId,
            content: displayTextToInlines(updatedSection.content || ''),
          },
        });
      } else {
        bus.dispatch({
          type: 'block/update',
          payload: {
            blockId: secId,
            title: updatedSection.title,
            content: displayTextToInlines(updatedSection.content || ''),
          },
        });
      }
    } catch (e) {
      console.warn('CommandBus block/update dispatch warning:', e);
    }
  }

  onChange(updated);
  return updated;
}

/**
 * Dispatches block removal to the CommandBus and removes section from list.
 */
export function dispatchRemoveSection(
  bus: CommandBus | undefined,
  secId: string,
  onChange: (updated: PaperSection[]) => void,
  current: PaperSection[]
): PaperSection[] {
  const actualIndex = current.findIndex((s, i) => (s.id || `sec_${i}`) === secId);
  if (actualIndex === -1) return current;

  const updated = [...current];
  updated.splice(actualIndex, 1);

  if (bus) {
    try {
      bus.dispatch({
        type: 'block/remove',
        payload: {
          blockId: secId,
        },
      });
    } catch (e) {
      console.warn('CommandBus block/remove dispatch warning:', e);
    }
  }

  onChange(updated);
  return updated;
}

/**
 * Dispatches reordering of sections (move up / move down).
 */
export function dispatchReorderSections(
  _bus: CommandBus | undefined,
  fromIndex: number,
  toIndex: number,
  onChange: (updated: PaperSection[]) => void,
  current: PaperSection[]
): PaperSection[] {
  if (fromIndex < 0 || fromIndex >= current.length) return current;
  if (toIndex < 0 || toIndex >= current.length) return current;

  const updated = [...current];
  const item = updated[fromIndex];
  updated[fromIndex] = updated[toIndex];
  updated[toIndex] = item;

  onChange(updated);
  return updated;
}
