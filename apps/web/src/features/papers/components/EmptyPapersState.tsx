'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText, RotateCcw, Sparkles } from 'lucide-react';

interface EmptyPapersStateProps {
  isFiltered?: boolean;
  onResetFilters?: () => void;
  onCreateFromTemplate?: () => void;
}

export const EmptyPapersState: React.FC<EmptyPapersStateProps> = ({
  isFiltered = false,
  onResetFilters,
  onCreateFromTemplate,
}) => {
  const router = useRouter();

  if (isFiltered) {
    return (
      <div data-testid="empty-papers-state">
        <EmptyState
          icon={FileText}
          title="Không tìm thấy bài báo nào"
          description="Không có bài báo nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại."
          buttonText={onResetFilters ? 'Đặt lại bộ lọc' : undefined}
          buttonIcon={RotateCcw}
          onButtonClick={onResetFilters}
          className="py-14 md:py-20"
        />
      </div>
    );
  }

  return (
    <div data-testid="empty-papers-state">
      <EmptyState
        icon={FileText}
        title="Chưa có bài báo nào"
        description="Bắt đầu tạo bài báo khoa học đầu tiên của bạn từ mẫu chuẩn ĐHQG-HCM."
        buttonText="Tạo từ mẫu"
        buttonIcon={Sparkles}
        onButtonClick={onCreateFromTemplate || (() => router.push('/templates'))}
        className="py-14 md:py-20"
      />
    </div>
  );
};
