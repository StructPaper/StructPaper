// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import LoginPage from '@/app/login/page';
import { http } from '@structpaper/api-client';

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue('/papers'),
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, layoutId, initial, animate, exit, transition, ...props }: any) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('LoginPage and Session Expiration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders login form elements and brand title', () => {
    render(<LoginPage />);

    expect(screen.getByText('StructPaper')).toBeDefined();
    expect(screen.getByPlaceholderText('admin@structpaper.org')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: /đăng nhập hệ thống/i })).toBeDefined();
  });

  it('allows user to input email, password and toggle remember me', () => {
    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('admin@structpaper.org') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('••••••••••••') as HTMLInputElement;
    const rememberMeCheckbox = screen.getByRole('checkbox', { name: /ghi nhớ đăng nhập/i }) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'custom@user.org' } });
    fireEvent.change(passwordInput, { target: { value: 'SecretPassword123!' } });
    fireEvent.click(rememberMeCheckbox);

    expect(emailInput.value).toBe('custom@user.org');
    expect(passwordInput.value).toBe('SecretPassword123!');
    expect(rememberMeCheckbox.checked).toBe(false);
  });

  it('displays session expired alert banner when auth_expired flag is in localStorage', () => {
    localStorage.setItem('auth_expired', 'true');
    render(<LoginPage />);

    expect(screen.getByText('Phiên làm việc đã hết hạn')).toBeDefined();
    expect(screen.getByText(/phiên đăng nhập trước của bạn đã kết thúc/i)).toBeDefined();
  });

  it('submits login form and redirects to /papers on success', async () => {
    const postSpy = vi.spyOn(http, 'post').mockResolvedValueOnce({
      accessToken: 'test-access-token-jwt',
      refreshToken: 'test-refresh-token',
      user: {
        id: 'user-admin-1',
        email: 'admin@structpaper.org',
        displayName: 'System SuperAdmin',
        status: 'ACTIVE',
        roles: ['SuperAdmin'],
      },
    } as any);

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('admin@structpaper.org'), {
      target: { value: 'admin@structpaper.org' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
      target: { value: 'AdminPassword123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập hệ thống/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/api/v1/auth/login', {
        email: 'admin@structpaper.org',
        password: 'AdminPassword123!',
      });
      expect(mockPush).toHaveBeenCalledWith('/papers');
    });
  });

  it('displays error message when login fails', async () => {
    vi.spyOn(http, 'post').mockRejectedValueOnce({
      detail: 'Email hoặc mật khẩu không chính xác',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('admin@structpaper.org'), {
      target: { value: 'wrong@structpaper.org' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
      target: { value: 'WrongPassword!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập hệ thống/i }));

    await waitFor(() => {
      expect(screen.getByText('Email hoặc mật khẩu không chính xác')).toBeDefined();
    });
  });
});
