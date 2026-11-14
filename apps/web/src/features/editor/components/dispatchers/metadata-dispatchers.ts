import { CommandBus } from '@structpaper/editor-core';
import { PaperDates, PaperMetadata } from '@/types/paper';

export function dispatchTitleChange(
  bus: CommandBus | undefined,
  title: string,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateTitle',
        payload: { title: [{ t: 'text', v: title }] },
      });
    } catch (e) {
      console.warn('CommandBus title dispatch warning:', e);
    }
  }
  onChange({ ...current, title });
}

export function dispatchTitleEnChange(
  bus: CommandBus | undefined,
  titleEn: string,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateField',
        payload: { field: 'translations', value: { en: [{ t: 'text', v: titleEn }] } },
      });
    } catch (e) {
      console.warn('CommandBus titleEn dispatch warning:', e);
    }
  }
  onChange({ ...current, titleEn });
}

export function dispatchAbstractChange(
  bus: CommandBus | undefined,
  abstract: string,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateAbstract',
        payload: { abstract: [[{ t: 'text', v: abstract }]] },
      });
    } catch (e) {
      console.warn('CommandBus abstract dispatch warning:', e);
    }
  }
  onChange({ ...current, abstract });
}

export function dispatchAbstractEnChange(
  bus: CommandBus | undefined,
  abstractEn: string,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateField',
        payload: { field: 'abstractEn', value: abstractEn },
      });
    } catch (e) {
      console.warn('CommandBus abstractEn dispatch warning:', e);
    }
  }
  onChange({ ...current, abstractEn });
}

export function dispatchKeywordsChange(
  bus: CommandBus | undefined,
  keywords: string[],
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateKeywords',
        payload: { keywords },
      });
    } catch (e) {
      console.warn('CommandBus keywords dispatch warning:', e);
    }
  }
  onChange({ ...current, keywords });
}

export function dispatchKeywordsEnChange(
  bus: CommandBus | undefined,
  keywordsEn: string[],
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateField',
        payload: { field: 'keywordsEn', value: keywordsEn },
      });
    } catch (e) {
      console.warn('CommandBus keywordsEn dispatch warning:', e);
    }
  }
  onChange({ ...current, keywordsEn });
}

export function dispatchDatesChange(
  bus: CommandBus | undefined,
  dates: Partial<PaperDates>,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const updatedDates: PaperDates = {
    ...current.dates,
    ...dates,
  };
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateDates',
        payload: { dates: updatedDates },
      });
    } catch (e) {
      console.warn('CommandBus dates dispatch warning:', e);
    }
  }
  onChange({ ...current, dates: updatedDates });
}

export function dispatchMetadataField(
  bus: CommandBus | undefined,
  field: string,
  value: unknown,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  if (bus) {
    try {
      bus.dispatch({
        type: 'metadata/updateField',
        payload: { field, value },
      });
    } catch (e) {
      console.warn('CommandBus field dispatch warning:', e);
    }
  }
  onChange({ ...current, [field]: value });
}
