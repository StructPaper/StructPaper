import { http } from '../http';

export interface CompileLatexPayload {
  tex?: string;
  texContent?: string;
  engine?: string;
  jobName?: string;
  autoFontFallback?: boolean;
  images?: Record<string, string>;
  [key: string]: any;
}

export const compileApi = {
  compileLatex: <T = any>(data: CompileLatexPayload, config?: any) => {
    return http.post<T>('/api/v1/compile/latex', data, {
      responseType: 'arraybuffer',
      ...config,
    }) as unknown as Promise<T>;
  },
};
