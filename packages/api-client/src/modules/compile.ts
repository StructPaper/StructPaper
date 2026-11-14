import { http } from '../http';

export interface CompileLatexPayload {
  tex: string;
  engine?: string;
  jobName?: string;
  images?: Record<string, string>;
  [key: string]: any;
}

export const compileApi = {
  compileLatex: <T = Blob>(data: CompileLatexPayload) => {
    return http.post<T>('/api/v1/compile/latex', data, {
      responseType: 'blob',
    }) as unknown as Promise<T>;
  },
};
