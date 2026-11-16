import { sileo } from '@/components/toast';
import type { SaveState } from '@/lib/documents/autosave-controller';

/**
 * Emits an accurate toast matching the settled SaveState from an explicit save.
 * Returns true only when persistence succeeded cleanly.
 */
export function notifyManualSaveOutcome(state: SaveState, isLocalAvailable?: boolean): boolean {
  if (state === 'saved') {
    sileo.success({
      title: 'Đã lưu tài liệu',
      description: 'Nội dung đã được lưu vào máy chủ và tạo phiên bản mới',
    });
    return true;
  }
  if (state === 'saved-local') {
    if (isLocalAvailable === false) {
      sileo.success({
        title: 'Đã lưu tài liệu',
        description: 'Nội dung đã được lưu lên máy chủ thành công',
      });
      return true;
    }
    sileo.success({
      title: 'Đã lưu trên máy',
      description: 'Nội dung đã được lưu cục bộ (chưa đồng bộ máy chủ)',
    });
    return true;
  }
  if (state === 'conflict') {
    sileo.warning({
      title: 'Xung đột phiên bản máy chủ',
      description: 'Máy chủ đang có bản mới hơn từ phiên làm việc khác. Bạn có thể chọn "Ghi đè" trên thanh tiêu đề.',
      status: 412,
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
    description:
      isLocalAvailable === false
        ? 'Không thể lưu bản thảo lên máy chủ. Vui lòng kiểm tra lại kết nối mạng.'
        : 'Không thể lưu bản thảo cục bộ vào thiết bị',
  });
  return false;
}
