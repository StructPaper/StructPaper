import { Metadata } from 'next';
import { PaperHubView } from '@/features/papers/components/PaperHubView';

export const metadata: Metadata = {
  title: 'Soạn Thảo Bài Báo Khoa Học (Typst) | StructPaper',
  description:
    'Tạo và chỉnh sửa bài báo khoa học dựa trên các mẫu chuẩn VNUHCM, IEEE, Nature với trình biên dịch Typst hiện đại.',
};

export default function PapersPage() {
  return <PaperHubView />;
}
