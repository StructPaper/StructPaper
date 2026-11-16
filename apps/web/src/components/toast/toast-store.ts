'use client';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default' | 'loading';
export type ToastVariant = 'island' | 'full-width-sticky';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  inline?: boolean;
  sticky?: boolean;
  variant?: ToastVariant;
  createdAt: number;
}

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title?: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  dismissible?: boolean;
  inline?: boolean;
  sticky?: boolean;
  variant?: ToastVariant;
  mode?: 'auto' | 'single-line' | 'two-line' | 'inline';
  theme?: 'success' | 'error' | 'warning' | 'white' | 'default' | 'sky';
  code?: string | number;
  status?: number | string;
  error?: unknown;
}

type ToastListener = (toasts: ToastItem[]) => void;

/**
 * Extracts standard HTTP error status codes (4xx, 5xx) or short alphanumeric error codes (e.g. ERR_NETWORK)
 * from ToastOptions, error objects, or message content.
 */
function extractErrorCode(item: {
  title?: string;
  description?: string;
  code?: string | number;
  status?: number | string;
  error?: unknown;
}): string | number | undefined {
  // 1. Explicit code or status on options
  if (item.code !== undefined && item.code !== null && String(item.code).trim()) {
    return String(item.code).trim();
  }
  if (item.status !== undefined && item.status !== null) {
    const s = Number(item.status);
    if (!isNaN(s) && s > 0) return s;
  }

  // 2. Extracted from Error object (AxiosError, ProblemDetailsError, custom Error)
  const err: any = item.error;
  if (err && typeof err === 'object') {
    const status = Number(
      err.status ??
      err.statusCode ??
      err.response?.status ??
      err.response?.data?.statusCode ??
      err.data?.statusCode
    );
    if (!isNaN(status) && status >= 400 && status <= 599) {
      return status;
    }

    const code = err.code ?? err.response?.data?.code ?? err.data?.code;
    if (code && typeof code === 'string' && code.trim()) {
      return code.trim();
    }
  }

  // 3. Scan description / title for explicit status patterns:
  // e.g. "status code 412", "status: 404", "mã lỗi: 412", "code: 500", "HTTP 412", "error 412"
  const textToScan = `${item.description || ''} ${item.title || ''}`;

  const explicitPattern = /(?:status(?:\s*code)?|mã\s*lỗi|error(?:\s*code)?|http|lỗi)[:\s#]*([45][0-9]{2})\b/i;
  const explicitMatch = textToScan.match(explicitPattern);
  if (explicitMatch) {
    return Number(explicitMatch[1]);
  }

  // Standard Axios message pattern: "Request failed with status code 404"
  const axiosMatch = textToScan.match(/failed with status code\s*([45][0-9]{2})\b/i);
  if (axiosMatch) {
    return Number(axiosMatch[1]);
  }

  // Known string error codes like ERR_NETWORK, ECONNREFUSED, ENOTFOUND
  const sysCodeMatch = textToScan.match(/\b(ERR_[A-Z0-9_]+|ECONN[A-Z0-9_]+|ENOTFOUND)\b/);
  if (sysCodeMatch) {
    return sysCodeMatch[1];
  }

  return undefined;
}

/**
 * Formats title with error code in parentheses, e.g. "Lỗi cập nhật (412)" or "Lỗi kết nối (ERR_NETWORK)".
 * Avoids duplicating if title already contains (code) or ends with (xxx).
 */
function formatTitleWithErrorCode(
  title: string,
  type: ToastType,
  item: {
    description?: string;
    code?: string | number;
    status?: number | string;
    error?: unknown;
  }
): string {
  if (type !== 'error' && type !== 'warning') {
    return title;
  }

  const code = extractErrorCode({ title, ...item });
  if (!code) {
    return title;
  }

  const codeStr = String(code);
  const trimmedTitle = title.trim();

  // If title already contains (code) or [code] or ends with (xxx), don't duplicate
  if (
    trimmedTitle.includes(`(${codeStr})`) ||
    trimmedTitle.includes(`[${codeStr}]`) ||
    /\([A-Za-z0-9_-]+\)\s*$/.test(trimmedTitle)
  ) {
    return title;
  }

  return `${trimmedTitle} (${codeStr})`;
}

class ToastStore {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private count = 0;

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }

  public addToast(item: Omit<ToastItem, 'id' | 'createdAt'> & {
    id?: string;
    code?: string | number;
    status?: number | string;
    error?: unknown;
  }): string {
    const formattedTitle = formatTitleWithErrorCode(item.title, item.type, {
      description: item.description,
      code: item.code,
      status: item.status,
      error: item.error,
    });

    const id = item.id || `toast-${Date.now()}-${++this.count}`;
    const newToast: ToastItem = {
      ...item,
      title: formattedTitle,
      id,
      dismissible: item.dismissible !== false,
      createdAt: Date.now(),
    };

    // Keep active toasts (can replace or keep latest 3 normal toasts, sticky toasts never evicted)
    const existingIndex = this.toasts.findIndex((t) => t.id === id);
    if (existingIndex >= 0) {
      this.toasts[existingIndex] = newToast;
    } else if (newToast.sticky) {
      // Sticky toasts are never evicted by new toasts
      const stickyToasts = this.toasts.filter((t) => t.sticky);
      const normalToasts = this.toasts.filter((t) => !t.sticky);
      this.toasts = [newToast, ...stickyToasts, ...normalToasts];
    } else {
      // Keep last 3 normal toasts max, preserve all sticky toasts
      const stickyToasts = this.toasts.filter((t) => t.sticky);
      const normalToasts = this.toasts.filter((t) => !t.sticky);
      this.toasts = [...stickyToasts, newToast, ...normalToasts.slice(0, 2)];
    }

    this.notify();
    return id;
  }

  public updateToast(id: string, updates: Partial<ToastItem> & {
    code?: string | number;
    status?: number | string;
    error?: unknown;
  }) {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index >= 0) {
      const existing = this.toasts[index];
      const type = updates.type ?? existing.type;
      const rawTitle = updates.title ?? existing.title;
      const formattedTitle = formatTitleWithErrorCode(rawTitle, type, {
        description: updates.description ?? existing.description,
        code: updates.code,
        status: updates.status,
        error: updates.error,
      });

      this.toasts[index] = { ...this.toasts[index], ...updates, title: formattedTitle };
      this.notify();
    }
  }

  public dismissToast(id?: string) {
    if (!id) {
      this.toasts = [];
    } else {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }
    this.notify();
  }

  public clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toastStore = new ToastStore();

// Smart payload parser for backward compatibility
function parseArgs(
  titleOrMsg: string | ToastOptions | any,
  descriptionOrOpts?: string | ToastOptions | any,
  fallbackType: ToastType = 'default'
): { title: string; description?: string; options: ToastOptions } {
  // 1. If titleOrMsg is an Error instance or error-like object
  if (
    titleOrMsg instanceof Error ||
    (typeof titleOrMsg === 'object' && titleOrMsg !== null && 'message' in titleOrMsg && !('title' in titleOrMsg))
  ) {
    const err = titleOrMsg as any;
    return {
      title: err.title || 'Lỗi',
      description: err.detail || err.message,
      options: {
        error: err,
        status: err.status ?? err.statusCode ?? err.response?.status,
        code: err.code,
      },
    };
  }

  // 2. If titleOrMsg is a ToastOptions object
  if (typeof titleOrMsg === 'object' && titleOrMsg !== null) {
    return {
      title: titleOrMsg.title || '',
      description: titleOrMsg.description,
      options: titleOrMsg,
    };
  }

  // 3. If descriptionOrOpts is an Error instance or error-like object
  if (
    descriptionOrOpts instanceof Error ||
    (typeof descriptionOrOpts === 'object' &&
      descriptionOrOpts !== null &&
      'message' in descriptionOrOpts &&
      !('title' in descriptionOrOpts) &&
      !('description' in descriptionOrOpts))
  ) {
    const err = descriptionOrOpts as any;
    return {
      title: typeof titleOrMsg === 'string' ? titleOrMsg : 'Lỗi',
      description: err.detail || err.message,
      options: {
        error: err,
        status: err.status ?? err.statusCode ?? err.response?.status,
        code: err.code,
      },
    };
  }

  // 4. If descriptionOrOpts is a ToastOptions object
  if (typeof descriptionOrOpts === 'object' && descriptionOrOpts !== null) {
    return {
      title: titleOrMsg,
      description: descriptionOrOpts.description,
      options: descriptionOrOpts,
    };
  }

  let title = titleOrMsg;
  let description = descriptionOrOpts;

  // If no description provided and title contains a colon (e.g. "Đã lưu: Bài báo...")
  if (!description && title && typeof title === 'string' && title.includes(':')) {
    const idx = title.indexOf(':');
    const head = title.slice(0, idx).trim();
    const tail = title.slice(idx + 1).trim();
    if (head.length > 0 && head.length <= 30 && tail.length > 0) {
      title = head;
      description = tail;
    }
  }

  return {
    title: title || '',
    description,
    options: {},
  };
}

export const toast = {
  success: (title: string | ToastOptions, description?: string | ToastOptions, opts?: ToastOptions) => {
    const parsed = parseArgs(title, description, 'success');
    const options = { ...parsed.options, ...(opts || {}) };
    return toastStore.addToast({
      id: options.id,
      type: 'success',
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? 3500,
      action: options.action,
      dismissible: options.dismissible,
      inline: options.inline ?? (options.mode === 'inline'),
    });
  },
  error: (title: string | ToastOptions, description?: string | ToastOptions, opts?: ToastOptions) => {
    const parsed = parseArgs(title, description, 'error');
    const options = { ...parsed.options, ...(opts || {}) };
    return toastStore.addToast({
      id: options.id,
      type: 'error',
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? 4500,
      action: options.action,
      dismissible: options.dismissible,
      inline: options.inline ?? (options.mode === 'inline'),
      code: options.code,
      status: options.status,
      error: options.error,
    });
  },
  warning: (title: string | ToastOptions, description?: string | ToastOptions, opts?: ToastOptions) => {
    const parsed = parseArgs(title, description, 'warning');
    const options = { ...parsed.options, ...(opts || {}) };
    return toastStore.addToast({
      id: options.id,
      type: 'warning',
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? 4000,
      action: options.action,
      dismissible: options.dismissible,
      inline: options.inline ?? (options.mode === 'inline'),
      code: options.code,
      status: options.status,
      error: options.error,
    });
  },
  info: (title: string | ToastOptions, description?: string | ToastOptions, opts?: ToastOptions) => {
    const parsed = parseArgs(title, description, 'info');
    const options = { ...parsed.options, ...(opts || {}) };
    return toastStore.addToast({
      id: options.id,
      type: 'info',
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? 3500,
      action: options.action,
      dismissible: options.dismissible,
      inline: options.inline ?? (options.mode === 'inline'),
    });
  },
  default: (title: string | ToastOptions, description?: string | ToastOptions, opts?: ToastOptions) => {
    const parsed = parseArgs(title, description, 'default');
    const options = { ...parsed.options, ...(opts || {}) };
    return toastStore.addToast({
      id: options.id,
      type: 'default',
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? 3500,
      action: options.action,
      dismissible: options.dismissible,
      inline: options.inline ?? (options.mode === 'inline'),
    });
  },
  loading: (title: string | ToastOptions, description?: string | ToastOptions, opts?: ToastOptions) => {
    const parsed = parseArgs(title, description, 'loading');
    const options = { ...parsed.options, ...(opts || {}) };
    return toastStore.addToast({
      id: options.id,
      type: 'loading',
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? Infinity,
      action: options.action,
      dismissible: options.dismissible,
      inline: options.inline ?? (options.mode === 'inline'),
    });
  },
  sticky: (
    title: string | ToastOptions,
    description?: string | ToastOptions,
    opts?: ToastOptions
  ): string => {
    const parsed = parseArgs(title, description, 'info');
    const options = { ...parsed.options, ...(opts || {}) };
    const effectiveType =
      options.type ??
      (options.theme && ['success', 'error', 'warning', 'info', 'default', 'loading'].includes(options.theme)
        ? (options.theme as ToastType)
        : undefined) ??
      (parsed.options.type ?? 'info');
    return toastStore.addToast({
      id: options.id,
      type: effectiveType,
      title: parsed.title,
      description: parsed.description,
      duration: options.duration ?? Infinity,
      action: options.action,
      dismissible: options.dismissible !== false,
      inline: options.inline ?? (options.mode === 'inline'),
      sticky: true,
      variant: options.variant ?? 'full-width-sticky',
      code: options.code,
      status: options.status,
      error: options.error,
    });
  },
  promise: <T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    },
    opts?: ToastOptions
  ): Promise<T> => {
    const id = opts?.id || `promise-${Date.now()}`;
    toastStore.addToast({
      id,
      type: 'loading',
      title: messages.loading,
      duration: Infinity,
      dismissible: opts?.dismissible ?? false,
    });

    const targetPromise = typeof promise === 'function' ? promise() : promise;

    return targetPromise
      .then((data) => {
        const successTitle =
          typeof messages.success === 'function'
            ? messages.success(data)
            : messages.success;
        const parsed = parseArgs(successTitle, opts?.description, 'success');
        toastStore.updateToast(id, {
          type: 'success',
          title: parsed.title,
          description: parsed.description,
          duration: opts?.duration ?? 3500,
          dismissible: true,
        });
        return data;
      })
      .catch((err) => {
        const errorTitle =
          typeof messages.error === 'function'
            ? messages.error(err)
            : messages.error;
        const parsed = parseArgs(errorTitle, opts?.description, 'error');
        toastStore.updateToast(id, {
          type: 'error',
          title: parsed.title,
          description: parsed.description,
          duration: opts?.duration ?? 4500,
          dismissible: true,
          error: err,
          status: err?.status ?? err?.statusCode ?? err?.response?.status,
          code: err?.code,
        });
        throw err;
      });
  },
  dismiss: (id?: string) => toastStore.dismissToast(id),
  clear: () => toastStore.clear(),
};

// Sileo drop-in replacement API for 100% backward compatibility
export const sileo = {
  success: (opts: any) => {
    if (typeof opts === 'string') return toast.success(opts);
    return toast.success(opts.title || '', opts.description, opts);
  },
  error: (opts: any) => {
    if (typeof opts === 'string') return toast.error(opts);
    return toast.error(opts.title || '', opts.description, opts);
  },
  warning: (opts: any) => {
    if (typeof opts === 'string') return toast.warning(opts);
    return toast.warning(opts.title || '', opts.description, opts);
  },
  info: (opts: any) => {
    if (typeof opts === 'string') return toast.info(opts);
    return toast.info(opts.title || '', opts.description, opts);
  },
  sticky: (opts: any, desc?: any, extraOpts?: any) => {
    if (typeof opts === 'string') return toast.sticky(opts, desc, extraOpts);
    return toast.sticky(opts.title || '', opts.description, opts);
  },
  promise: <T>(promise: Promise<T> | (() => Promise<T>), messages: any, opts?: any) => {
    return toast.promise(promise, messages, opts);
  },
  dismiss: (id?: string) => toast.dismiss(id),
  clear: () => toast.clear(),
};
