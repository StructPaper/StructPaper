import { http } from '../http';
import type {
  ManuscriptResponse,
  ManuscriptMember,
} from '@structpaper/contracts';

export interface ManuscriptListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  [key: string]: any;
}

export interface CreateManuscriptPayload {
  title: string;
  journalId?: string;
  metadata?: any;
  abstract?: string | null;
  [key: string]: any;
}

export interface AddMemberPayload {
  userId: string;
  role: string;
}

export const manuscriptApi = {
  list: <T = ManuscriptResponse[] | { data: ManuscriptResponse[]; total?: number }>(
    params?: ManuscriptListParams,
  ) => {
    return http.get<T>('/api/v1/manuscripts', { params }) as unknown as Promise<T>;
  },

  get: <T = ManuscriptResponse>(id: string) => {
    return http.get<T>(`/api/v1/manuscripts/${id}`) as unknown as Promise<T>;
  },

  create: <T = ManuscriptResponse>(data: CreateManuscriptPayload) => {
    return http.post<T>('/api/v1/manuscripts', data) as unknown as Promise<T>;
  },

  update: <T = ManuscriptResponse>(
    id: string,
    data: any,
    headers?: Record<string, string>,
  ) => {
    return http.patch<T>(`/api/v1/manuscripts/${id}`, data, { headers }) as unknown as Promise<T>;
  },

  delete: <T = { success: boolean }>(id: string) => {
    return http.delete<T>(`/api/v1/manuscripts/${id}`) as unknown as Promise<T>;
  },

  getMembers: <T = ManuscriptMember[]>(id: string) => {
    return http.get<T>(`/api/v1/manuscripts/${id}/members`) as unknown as Promise<T>;
  },

  addMember: <T = ManuscriptMember>(id: string, data: AddMemberPayload) => {
    return http.post<T>(`/api/v1/manuscripts/${id}/members`, data) as unknown as Promise<T>;
  },

  removeMember: <T = { success: boolean }>(id: string, userId: string) => {
    return http.delete<T>(`/api/v1/manuscripts/${id}/members/${userId}`) as unknown as Promise<T>;
  },

  getVersions: <T = any[]>(id: string) => {
    return http.get<T>(`/api/v1/manuscripts/${id}/versions`) as unknown as Promise<T>;
  },
};
