import { ProblemDetailsError } from '@structpaper/api-client';

/** Backend messages for the self-service / last-admin rules, explained in plain Vietnamese. */
const FRIENDLY_MESSAGES: Array<[RegExp, string]> = [
  [
    /At least one active SuperAdmin must remain/i,
    'Hệ thống phải luôn còn ít nhất một SuperAdmin đang hoạt động. Hãy cấp SuperAdmin cho người khác trước.',
  ],
  [
    /cannot change your own/i,
    'Bạn không thể tự thay đổi vai trò hoặc trạng thái của chính mình. Hãy nhờ quản trị viên khác.',
  ],
];

function friendly(message: string): string {
  return FRIENDLY_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

/** Human readable message out of whatever an API call threw. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ProblemDetailsError) {
    return friendly(err.detail || err.title || fallback);
  }
  const anyErr = err as any;
  return friendly(
    anyErr?.detail ||
      anyErr?.response?.data?.detail ||
      anyErr?.response?.data?.message ||
      anyErr?.message ||
      fallback,
  );
}

/**
 * Copies text to the clipboard. Works on plain-http pages too (e.g. an internal VM without TLS),
 * where `navigator.clipboard` is unavailable. Returns false when nothing could be copied so the
 * caller can fall back to showing the text for manual copy.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    if (typeof document === 'undefined') return false;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Còn 2 ngày 3 giờ" / "Còn 5 giờ" / "Đã hết hạn". */
export function describeExpiry(iso: string, now: number = Date.now()): { label: string; expired: boolean } {
  const diff = new Date(iso).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) {
    return { label: 'Đã hết hạn', expired: true };
  }
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    const restHours = hours % 24;
    return { label: `Còn ${days} ngày${restHours ? ` ${restHours} giờ` : ''}`, expired: false };
  }
  if (hours >= 1) return { label: `Còn ${hours} giờ`, expired: false };
  return { label: `Còn ${Math.max(1, Math.floor(diff / 60_000))} phút`, expired: false };
}

/** The system roles seeded by the backend; used only until the live role list has loaded. */
export const FALLBACK_ROLE_NAMES = ['SuperAdmin', 'JournalManager', 'Editor', 'Reviewer', 'Author'] as const;

export const GLOBAL_SCOPE_LABEL = 'Toàn hệ thống (Global)';
