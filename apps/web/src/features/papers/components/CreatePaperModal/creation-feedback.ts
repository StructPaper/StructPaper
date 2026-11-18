import { toast } from '@/components/toast';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tells the user what really happened after creating a paper and says whether to carry on
 * (open it). A server id means it is on the server; a local id means it is only on this machine;
 * `saved === false` means it is nowhere.
 */
export function notifyPaperCreated(saved: boolean | void, paperId: string | undefined, standard: string): boolean {
  if (saved === false) {
    toast.error('Không thể tạo bài báo', 'Máy chủ từ chối yêu cầu và bài chưa được lưu. Vui lòng thử lại.');
    return false;
  }
  if (UUID.test(String(paperId))) {
    toast.success('Khởi tạo bài báo thành công', `Đã tạo bài báo mới theo chuẩn "${standard}"`);
  } else {
    toast.warning('Đã lưu bài báo trên máy', 'Chưa đồng bộ được lên máy chủ nên chưa chia sẻ được.');
  }
  return true;
}
