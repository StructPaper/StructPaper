'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { PaperSection } from '@/types/paper';
import { parsePastedTableText } from './utils';
import {
  createSessionImageObjectUrl,
  cacheBlobAssetQuietly,
} from '@/lib/media/blob-image-registry';

function resolveFigureSectionIndex(
  latestSections: PaperSection[],
  target: { targetSecId?: string; blobUrl?: string; targetFigId?: string; previousSrc?: string }
): number {
  if (target.targetSecId) {
    return latestSections.findIndex((s) => s.id === target.targetSecId);
  }
  if (target.blobUrl) {
    return latestSections.findIndex(
      (s) => s.type === 'figure' && s.figure?.src === target.blobUrl
    );
  }
  if (target.targetFigId) {
    return latestSections.findIndex(
      (s) => s.type === 'figure' && s.figure?.id === target.targetFigId
    );
  }
  if (target.previousSrc !== undefined) {
    return latestSections.findIndex(
      (s) => s.type === 'figure' && s.figure?.src === target.previousSrc
    );
  }
  return -1;
}

export function useSectionMediaHandlers(
  sections: PaperSection[],
  onUpdateSection: (index: number, updated: PaperSection) => void
) {
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const onUpdateSectionRef = useRef(onUpdateSection);
  onUpdateSectionRef.current = onUpdateSection;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Table Paste handlers
  const handleApplyTablePaste = useCallback((secIdx: number, text: string) => {
    const parsed = parsePastedTableText(text);
    if (!parsed) return;
    const sec = sectionsRef.current[secIdx];
    if (!sec?.table) return;

    onUpdateSectionRef.current(secIdx, {
      ...sec,
      table: {
        ...sec.table,
        headers: parsed.headers,
        rows: parsed.rows,
        headerRows: undefined,
        bodyRows: undefined,
      },
    });
  }, []);

  const handlePasteTableData = useCallback(
    (secIdx: number, e: React.ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trim()) {
        e.preventDefault();
        handleApplyTablePaste(secIdx, text);
      }
    },
    [handleApplyTablePaste]
  );

  const handlePasteTableFromClipboardButton = useCallback(
    async (secIdx: number) => {
      try {
        const text = await navigator.clipboard.readText();
        if (!isMountedRef.current) return;
        if (text && text.trim()) {
          handleApplyTablePaste(secIdx, text);
        }
      } catch {
        alert('Vui lòng chọn khung và nhấn phím Ctrl + V trực tiếp trên bàn phím!');
      }
    },
    [handleApplyTablePaste]
  );

  // Figure image paste & upload handlers
  const handleApplyFigureImage = useCallback(
    (secIdx: number, src: string, assetId?: string) => {
      const sec = sectionsRef.current[secIdx];
      if (!sec?.figure) return;
      const nextFigure = { ...sec.figure, src };
      if (assetId !== undefined) {
        nextFigure.assetId = assetId;
      } else {
        delete nextFigure.assetId;
      }
      onUpdateSectionRef.current(secIdx, {
        ...sec,
        figure: nextFigure,
      });
    },
    []
  );

  const applyFigureImageBlob = useCallback(
    (secIdx: number, blob: Blob) => {
      const sec = sectionsRef.current[secIdx];
      if (!sec?.figure) return;
      const targetSecId = sec.id;
      const targetFigId = sec.figure.id;
      const previousSrc = sec.figure.src;

      const blobUrl = createSessionImageObjectUrl(blob);
      if (blobUrl) {
        handleApplyFigureImage(secIdx, blobUrl);

        void cacheBlobAssetQuietly(blob).then((assetId) => {
          if (!assetId || !isMountedRef.current) return;
          const latestSections = sectionsRef.current;
          const resolvedIdx = resolveFigureSectionIndex(latestSections, {
            targetSecId,
            blobUrl,
          });
          if (resolvedIdx === -1) return;
          const latestSec = latestSections[resolvedIdx];
          if (!latestSec?.figure || latestSec.figure.src !== blobUrl) return;
          onUpdateSectionRef.current(resolvedIdx, {
            ...latestSec,
            figure: {
              ...latestSec.figure,
              assetId,
            },
          });
        });
        return;
      }

      // Fallback cleanly only if URL.createObjectURL is unavailable
      if (typeof FileReader !== 'undefined') {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          if (!isMountedRef.current) return;
          const dataUrl = loadEvt.target?.result;
          if (typeof dataUrl !== 'string' || !dataUrl) return;
          const latestSections = sectionsRef.current;
          const resolvedIdx = resolveFigureSectionIndex(latestSections, {
            targetSecId,
            targetFigId,
            previousSrc,
          });
          if (resolvedIdx === -1) return;
          const latestSec = latestSections[resolvedIdx];
          if (!latestSec?.figure || latestSec.figure.src !== previousSrc) return;
          handleApplyFigureImage(resolvedIdx, dataUrl);
        };
        reader.readAsDataURL(blob);
      }
    },
    [handleApplyFigureImage]
  );

  const handlePasteFigureImage = useCallback(
    (secIdx: number, e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              applyFigureImageBlob(secIdx, file);
            }
            return;
          }
        }
      }

      const text = e.clipboardData?.getData('text/plain');
      if (text && (text.startsWith('http') || text.startsWith('data:image/'))) {
        e.preventDefault();
        handleApplyFigureImage(secIdx, text.trim());
      }
    },
    [applyFigureImageBlob, handleApplyFigureImage]
  );

  const handlePasteImageFromClipboardButton = useCallback(
    async (secIdx: number) => {
      const targetSec = sectionsRef.current[secIdx];
      const targetSecId = targetSec?.id;
      const targetFigId = targetSec?.figure?.id;
      const previousSrc = targetSec?.figure?.src;

      try {
        const items = await navigator.clipboard.read();
        if (!isMountedRef.current) return;
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            if (!isMountedRef.current) return;
            const resolvedIdx = resolveFigureSectionIndex(sectionsRef.current, {
              targetSecId,
              targetFigId,
              previousSrc,
            });
            if (resolvedIdx === -1) return;
            applyFigureImageBlob(resolvedIdx, blob);
            return;
          }
        }
      } catch {
        try {
          const text = await navigator.clipboard.readText();
          if (!isMountedRef.current) return;
          if (text && (text.startsWith('http') || text.startsWith('data:image/'))) {
            const resolvedIdx = resolveFigureSectionIndex(sectionsRef.current, {
              targetSecId,
              targetFigId,
              previousSrc,
            });
            if (resolvedIdx === -1) return;
            handleApplyFigureImage(resolvedIdx, text.trim());
            return;
          }
        } catch {
          // Ignore clipboard fallback error
        }
        alert('Vui lòng chọn khung và nhấn phím Ctrl + V trực tiếp trên bàn phím!');
      }
    },
    [applyFigureImageBlob, handleApplyFigureImage]
  );

  const handleFileInputChange = useCallback(
    (secIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (file.type && !file.type.startsWith('image/')) return;
      applyFigureImageBlob(secIdx, file);
    },
    [applyFigureImageBlob]
  );

  const handleDropFigureImage = useCallback(
    (secIdx: number, e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && (!file.type || file.type.startsWith('image/'))) {
        applyFigureImageBlob(secIdx, file);
      }
    },
    [applyFigureImageBlob]
  );

  const handleTriggerFileInput = useCallback((secIdx: number) => {
    fileInputRefs.current[secIdx]?.click();
  }, []);

  const setFileInputRef = useCallback((secIdx: number, el: HTMLInputElement | null) => {
    fileInputRefs.current[secIdx] = el;
  }, []);

  return {
    fileInputRefs,
    setFileInputRef,
    handlePasteTableData,
    handlePasteTableFromClipboardButton,
    handlePasteFigureImage,
    handlePasteImageFromClipboardButton,
    handleFileInputChange,
    handleDropFigureImage,
    handleTriggerFileInput,
  };
}
