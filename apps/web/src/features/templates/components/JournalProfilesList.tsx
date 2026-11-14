'use client';

import React from 'react';
import { JournalProfileCard } from './JournalProfileCard';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookOpen, RotateCcw } from 'lucide-react';

interface JournalProfilesListProps {
  journals: ManagedJournalProfile[];
  onCreatePaper: (managed: ManagedJournalProfile) => void;
  onResetFilters?: () => void;
}

export const JournalProfilesList: React.FC<JournalProfilesListProps> = ({
  journals,
  onCreatePaper,
  onResetFilters,
}) => {
  if (journals.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Không tìm thấy mẫu tạp chí"
        description="Không có mẫu tạp chí nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại."
        buttonText={onResetFilters ? 'Đặt lại bộ lọc' : undefined}
        buttonIcon={RotateCcw}
        onButtonClick={onResetFilters}
        className="py-16 md:py-24"
      />
    );
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
      {journals.map((journal) => (
        <JournalProfileCard
          key={journal.id}
          managed={journal}
          onCreatePaper={onCreatePaper}
        />
      ))}
    </div>
  );
};
