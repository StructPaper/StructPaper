import { Metadata } from 'next';
import { JournalHubView } from '@/features/templates/components/JournalHubView';

export const metadata: Metadata = {
  title: 'Quản Lý Mẫu & Tạp Chí Khoa Học | StructPaper',
  description:
    'Quản lý cấu hình 7 Tạp chí ĐHQG-HCM, quy định tóm tắt, từ khóa, trích dẫn Vancouver và dàn trang Typst/LaTeX.',
};

export default function TemplatesPage() {
  return <JournalHubView />;
}
