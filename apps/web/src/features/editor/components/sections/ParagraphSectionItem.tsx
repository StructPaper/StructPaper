'use client';

import React, { useCallback } from 'react';
import type { Inline } from '@structpaper/doc-model';
import { PaperSection, PaperReference } from '@/types/paper';
import { TipTapParagraphEditor } from './TipTapParagraphEditor';
import { getSectionId } from './useSectionVirtualizer';
import { ImageIcon, Link2 } from 'lucide-react';

export interface ParagraphSectionItemProps {
  sec: PaperSection;
  idx: number;
  isPrevFigure?: boolean;
  prevFigureCaption?: string;
  isEditing?: boolean;
  onStartEdit?: (secId: string) => void;
  onEndEdit?: () => void;
  activeEditingParaId?: string | null;
  setActiveEditingParaId?: (id: string | null) => void;
  onUpdateSection: (index: number, updated: PaperSection) => void;
  onMergeParagraphIntoPrevFigure: (index: number) => void;
  onConvertToCitation?: (index: number) => void;
  references?: PaperReference[];
}

const ParagraphSectionItemBase: React.FC<ParagraphSectionItemProps> = ({
  sec,
  idx,
  isPrevFigure = false,
  prevFigureCaption,
  isEditing: propIsEditing,
  onStartEdit,
  onEndEdit,
  activeEditingParaId,
  setActiveEditingParaId,
  onUpdateSection,
  onMergeParagraphIntoPrevFigure,
  references,
}) => {
  const secId = getSectionId(sec, idx);
  const isEditing =
    propIsEditing !== undefined ? propIsEditing : activeEditingParaId === secId;

  const handleStartEdit = useCallback(() => {
    if (onStartEdit) {
      onStartEdit(secId);
    } else {
      setActiveEditingParaId?.(secId);
    }
  }, [onStartEdit, setActiveEditingParaId, secId]);

  const handleBlur = useCallback(() => {
    if (onEndEdit) {
      onEndEdit();
    } else {
      setActiveEditingParaId?.(null);
    }
  }, [onEndEdit, setActiveEditingParaId]);

  const handleChange = useCallback(
    (_inlines: Inline[], plainText: string) => {
      onUpdateSection(idx, { ...sec, content: plainText });
    },
    [onUpdateSection, idx, sec]
  );

  const handleMergeClick = useCallback(() => {
    onMergeParagraphIntoPrevFigure(idx);
  }, [onMergeParagraphIntoPrevFigure, idx]);

  const trimmedContent = sec.content.trim();
  const showFigureSourceAssist =
    isPrevFigure &&
    (trimmedContent.startsWith('(Nguồn') ||
      trimmedContent.startsWith('Nguồn:') ||
      trimmedContent.startsWith('(Source') ||
      trimmedContent.startsWith('Source:') ||
      trimmedContent.toLowerCase().startsWith('(nguồn') ||
      (sec.content.length < 120 && /\b(nguồn|source)\b/i.test(sec.content)));

  return (
    <div className="space-y-2">
      {/* Smart assist: Figure source detection */}
      {showFigureSourceAssist && (
        <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5 font-medium min-w-0">
            <ImageIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate">
              Ghi chú nguồn cho{' '}
              {prevFigureCaption
                ? `"${prevFigureCaption.slice(0, 30)}..."`
                : 'Hình phía trên'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleMergeClick}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer flex-shrink-0"
            title="Gộp đoạn này thành thuộc tính nguồn của Hình minh họa phía trên"
          >
            <Link2 className="w-3 h-3" />
            <span>Gộp vào Hình phía trên</span>
          </button>
        </div>
      )}

      <TipTapParagraphEditor
        value={sec.content || ''}
        isEditing={isEditing}
        onStartEdit={handleStartEdit}
        onBlur={handleBlur}
        onChange={handleChange}
        placeholder="Nội dung đoạn văn bản..."
        references={references}
      />
    </div>
  );
};

export const ParagraphSectionItem = React.memo(ParagraphSectionItemBase);
ParagraphSectionItem.displayName = 'ParagraphSectionItem';
