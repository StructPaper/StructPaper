export interface StatusMessageFallback {
  title: string;
  description: string;
}

/**
 * Standard Vietnamese status code dictionary for API & Network errors.
 * Used when the backend response does not provide localized problem details.
 */
export const STATUS_VI_FALLBACKS: Record<number, StatusMessageFallback> = {
  400: {
    title: 'Yêu cầu không hợp lệ',
    description: 'Dữ liệu gửi lên không đúng định dạng hoặc thiếu thông tin.',
  },
  401: {
    title: 'Phiên đăng nhập hết hạn',
    description: 'Vui lòng đăng nhập lại để tiếp tục.',
  },
  403: {
    title: 'Không có quyền truy cập',
    description: 'Bạn không có quyền thực hiện thao tác này.',
  },
  404: {
    title: 'Không tìm thấy tài nguyên',
    description: 'Tài nguyên được yêu cầu không tồn tại hoặc đã bị xóa.',
  },
  408: {
    title: 'Hết thời gian yêu cầu',
    description: 'Máy chủ phản hồi quá chậm. Vui lòng thử lại sau.',
  },
  409: {
    title: 'Xung đột dữ liệu',
    description: 'Dữ liệu đang bị xung đột với trạng thái hiện tại trên máy chủ.',
  },
  412: {
    title: 'Xung đột phiên bản máy chủ',
    description: 'Máy chủ đang có bản mới hơn từ phiên làm việc khác. Bạn có thể chọn "Ghi đè" trên thanh tiêu đề.',
  },
  422: {
    title: 'Dữ liệu không thể xử lý',
    description: 'Dữ liệu gửi lên không thể xử lý được.',
  },
  429: {
    title: 'Quá nhiều yêu cầu',
    description: 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau vài giây.',
  },
  500: {
    title: 'Lỗi máy chủ nội bộ',
    description: 'Đã xảy ra lỗi không mong muốn trên máy chủ. Vui lòng thử lại sau.',
  },
  502: {
    title: 'Cổng kết nối máy chủ bị lỗi',
    description: 'Không thể kết nối đến dịch vụ phía sau (Bad Gateway).',
  },
  503: {
    title: 'Dịch vụ tạm thời không khả dụng',
    description: 'Máy chủ đang bảo trì hoặc quá tải. Vui lòng thử lại sau.',
  },
  504: {
    title: 'Hết thời gian phản hồi từ máy chủ',
    description: 'Máy chủ mất quá nhiều thời gian để phản hồi (Gateway Timeout).',
  },
};

export function getStatusFallback(status?: number): StatusMessageFallback {
  if (status && STATUS_VI_FALLBACKS[status]) {
    return STATUS_VI_FALLBACKS[status];
  }
  return {
    title: status && status >= 500 ? 'Lỗi máy chủ nội bộ' : 'Lỗi yêu cầu máy chủ',
    description: 'Đã xảy ra lỗi trong quá trình xử lý yêu cầu.',
  };
}
