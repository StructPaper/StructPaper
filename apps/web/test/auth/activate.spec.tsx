// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ActivatePage from '@/app/activate/page';
import { http } from '@structpaper/api-client';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === 'token' ? 'tok_invite_test_999' : null)),
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

describe('ActivatePage (Account Invitation Acceptance Flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('submits activation request and redirects on success', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Account activated successfully',
    } as any);

    render(<ActivatePage />);

    const passwordInput = screen.getByPlaceholderText('Tối thiểu 8 ký tự...');
    const confirmInput = screen.getByPlaceholderText('Nhập lại mật khẩu...');
    const submitBtn = screen.getByRole('button', { name: /hoàn tất kích hoạt/i });

    fireEvent.change(passwordInput, { target: { value: 'NewSecurePassword123!' } });
    fireEvent.change(confirmInput, { target: { value: 'NewSecurePassword123!' } });

    expect(submitBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/api/v1/auth/activate', {
        token: 'tok_invite_test_999',
        password: 'NewSecurePassword123!',
      });
      expect(screen.getByText('Thiết lập hoàn tất!')).toBeDefined();
    });
  });

  it('displays error message when activation token is invalid or expired', async () => {
    vi.spyOn(http, 'post').mockRejectedValueOnce({
      detail: 'Mã kích hoạt không hợp lệ hoặc đã hết hạn',
    });

    render(<ActivatePage />);

    const passwordInput = screen.getByPlaceholderText('Tối thiểu 8 ký tự...');
    const confirmInput = screen.getByPlaceholderText('Nhập lại mật khẩu...');
    const submitBtn = screen.getByRole('button', { name: /hoàn tất kích hoạt/i });

    fireEvent.change(passwordInput, { target: { value: 'NewSecurePassword123!' } });
    fireEvent.change(confirmInput, { target: { value: 'NewSecurePassword123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Mã kích hoạt không hợp lệ hoặc đã hết hạn')).toBeDefined();
    });
  });
});
