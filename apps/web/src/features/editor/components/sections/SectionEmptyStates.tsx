'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { EndOfListIndicator as BaseEndOfListIndicator } from '../EndOfListIndicator';

export const EndOfListIndicator = React.memo(BaseEndOfListIndicator);
EndOfListIndicator.displayName = 'EndOfListIndicator';

export interface FilteredSectionsEmptyStateProps {
  totalSections: number;
  onShowAll: () => void;
}

const FilteredSectionsEmptyStateBase: React.FC<FilteredSectionsEmptyStateProps> = ({
  totalSections,
  onShowAll,
}) => {
  return (
    <div className="p-8 text-center rounded-3xl bg-gray-200/50 space-y-2.5">
      <p className="text-sm font-semibold text-zinc-600">
        Không có khối nội dung nào phù hợp với bộ lọc hiện tại.
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="btn-pill-subtle text-xs"
      >
        Xem tất cả ({totalSections})
      </button>
    </div>
  );
};

export const FilteredSectionsEmptyState = React.memo(FilteredSectionsEmptyStateBase);
FilteredSectionsEmptyState.displayName = 'FilteredSectionsEmptyState';

export interface EmptySectionsStateProps {
  onAddHeading: (level?: 'h1' | 'h2' | 'h3') => void;
  onAddParagraph: () => void;
}

const EmptySectionsStateBase: React.FC<EmptySectionsStateProps> = ({
  onAddHeading,
  onAddParagraph,
}) => {
  return (
    <div className="p-8 text-center rounded-3xl bg-gray-200/50 space-y-3">
      <FileText className="w-8 h-8 text-zinc-400 mx-auto" />
      <p className="text-sm font-semibold text-zinc-600">
        Chưa có khối nội dung nào trong bài báo.
      </p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onAddHeading('h1')}
          className="btn-pill-lime text-xs"
        >
          + Thêm tiêu đề H1
        </button>
        <button
          type="button"
          onClick={() => onAddParagraph()}
          className="btn-pill-subtle text-xs"
        >
          + Thêm đoạn văn
        </button>
      </div>
    </div>
  );
};

export const EmptySectionsState = React.memo(EmptySectionsStateBase);
EmptySectionsState.displayName = 'EmptySectionsState';
