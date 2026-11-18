// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ActivatePage from '@/app/(public)/activate/page';
import { http } from '@structpaper/api-client';

const mockPush = vi.fn();
// Token carried by the legacy "?token=" query string (empty = link without query token)
const search = vi.hoisted(() => ({ token: 'tok_invite_test_999' as string | null }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === 'token' ? search.token : null)),
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
  },
}));

const fillAndSubmit = (password = 'NewSecurePassword123!', confirm = password) => {
  fireEvent.change(screen.getByPlaceholderText('Tối thiểu 8 ký tự...'), { target: { value: password } });
  fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu...'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /hoàn tất kích hoạt/i }));
};

describe('ActivatePage (Account Invitation Acceptance Flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search.token = 'tok_invite_test_999';
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders activation form with auto-filled token from URL parameter', () => {
    render(<ActivatePage />);

    expect(screen.getByRole('heading', { name: /kích hoạt/i })).toBeDefined();
    const tokenInput = screen.getByPlaceholderText('tok_invitation_...') as HTMLInputElement;
    expect(tokenInput.value).toBe('tok_invite_test_999');
    expect(screen.getByPlaceholderText('Tối thiểu 8 ký tự...')).toBeDefined();
    expect(screen.getByPlaceholderText('Nhập lại mật khẩu...')).toBeDefined();
  });

  it('reads the token from the URL fragment (#token=...) and removes it from the address bar', async () => {
    search.token = null;
    window.location.hash = '#token=frag-token-abc123';

    render(<ActivatePage />);

    await waitFor(() => {
      const tokenInput = screen.getByPlaceholderText('tok_invitation_...') as HTMLInputElement;
      expect(tokenInput.value).toBe('frag-token-abc123');
    });
    // The secret must not stay in the URL / browser history
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('frag-token-abc123');
  });

  it('submits activation request and redirects on success', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Account activated successfully',
    } as any);

    render(<ActivatePage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/auth/activate',
        { token: 'tok_invite_test_999', password: 'NewSecurePassword123!' },
        // the page explains failures itself, so the generic network toast is skipped
        { skipGlobalToast: true },
      );
      expect(screen.getByText('Thiết lập hoàn tất!')).toBeDefined();
    });
  });

  it('explains an invalid, expired or already used link in plain Vietnamese', async () => {
    vi.spyOn(http, 'post').mockRejectedValueOnce({
      detail: 'Invalid or expired activation token',
    });

    render(<ActivatePage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getAllByText(/Liên kết kích hoạt không hợp lệ, đã hết hạn hoặc đã được sử dụng/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Invalid or expired activation token')).toBeNull();
  });

  it('shows other server messages as they are', async () => {
    vi.spyOn(http, 'post').mockRejectedValueOnce({
      detail: 'Password must be at least 8 characters',
    });

    render(<ActivatePage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getAllByText('Password must be at least 8 characters').length).toBeGreaterThan(0);
    });
  });

  it('does not call the API when the passwords do not match', () => {
    const postSpy = vi.spyOn(http, 'post');

    render(<ActivatePage />);
    fillAndSubmit('NewSecurePassword123!', 'SomethingElseEntirely');

    expect(postSpy).not.toHaveBeenCalled();
  });
});
