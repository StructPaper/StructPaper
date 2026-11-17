import { describe, it, expect, afterEach, vi } from 'vitest';
import axios from 'axios';
import { http, setGlobalApiErrorHandler } from '../src/index';

/**
 * Regression: React Query aborts in-flight requests when a tab unmounts or data is refetched.
 * Axios reports that as ERR_CANCELED (no response), which used to show a bogus
 * "Mất kết nối máy chủ (ERR_CANCELED)" toast although the data had loaded fine.
 */
describe('global API error toast', () => {
  const originalAdapter = http.defaults.adapter;

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    setGlobalApiErrorHandler(null);
  });

  it('does NOT toast a request that was cancelled on purpose', async () => {
    const handler = vi.fn();
    setGlobalApiErrorHandler(handler);
    http.defaults.adapter = async () => {
      throw new axios.CanceledError('canceled');
    };

    await expect(http.get('/api/v1/users')).rejects.toBeDefined();

    expect(handler).not.toHaveBeenCalled();
  });

  it('still toasts a genuine network failure', async () => {
    const handler = vi.fn();
    setGlobalApiErrorHandler(handler);
    http.defaults.adapter = async (config) => {
      throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config);
    };

    await expect(http.get('/api/v1/users')).rejects.toBeDefined();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].title).toBe('Mất kết nối máy chủ');
  });
});
