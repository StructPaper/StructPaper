import { http } from '../http';
import type { TokenResponse, UserSummary } from '@structpaper/contracts';

export interface LoginParams {
  email?: string;
  username?: string;
  password: string;
}

export const authApi = {
  login: <T = TokenResponse>(data: { email?: string; username?: string; password: string }) => {
    return http.post<T>('/api/v1/auth/login', data) as unknown as Promise<T>;
  },

  logout: <T = { success: boolean }>() => {
    return http.post<T>('/api/v1/auth/logout') as unknown as Promise<T>;
  },

  getAccount: <T = UserSummary>() => {
    return http.get<T>('/api/v1/auth/account') as unknown as Promise<T>;
  },

  refreshToken: <T = TokenResponse>(refreshToken?: string) => {
    if (refreshToken) {
      return http.post<T>('/api/v1/auth/refresh', { refreshToken }) as unknown as Promise<T>;
    }
    return http.get<T>('/api/v1/auth/refresh') as unknown as Promise<T>;
  },
};
