import { sileo } from '@/components/DynamicIslandToast';
import type { SaveState } from '@/lib/documents/autosave-controller';

/**
 * Emits an accurate toast matching the settled SaveState from an explicit save.
 * Returns true only when persistence succeeded cleanly.
 */
export function notifyManualSaveOutcome(state: SaveState): boolean {
  if (state === 'saved') {
    sileo.success({
      title: 'Đã lưu tài liệu',
      description: 'Nội dung đã được lưu và tạo phiên bản mới',
    });
    return true;
  }
  if (state === 'saved-local') {
    sileo.success({
      title: 'Đã lưu trên máy',
      description: 'Nội dung đã được lưu cục bộ (chưa đồng bộ máy chủ)',
    });
    return true;
  }
  if (state === 'conflict') {
    sileo.warning({
      title: 'Xung đột phiên bản',
      description: 'Máy chủ đang có bản mới hơn, hãy chọn Ghi đè hoặc kiểm tra lại',
    });
    return false;
  }
  if (state === 'dirty' || state === 'saving' || state === 'idle') {
    sileo.warning({
      title: 'Bản thảo còn thay đổi chưa lưu',
      description: 'Vui lòng chờ hoặc nhấn Lưu thêm lần nữa để hoàn tất thay đổi mới nhất',
    });
    return false;
  }
  sileo.error({
    title: 'Lưu thất bại',
    description: 'Không thể lưu bản thảo cục bộ vào thiết bị',
  });
  return false;
}
