import { z } from 'zod';

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  invalidParams?: InvalidParam[];
  [key: string]: unknown;
}

export const InvalidParamSchema = z.object({
  name: z.string(),
  reason: z.string(),
});

export const ProblemDetailsSchema = z
  .object({
    type: z.string().default('about:blank'),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string().optional(),
    code: z.string().optional(),
    invalidParams: z.array(InvalidParamSchema).optional(),
  })
  .passthrough();

export interface CreateProblemDetailsOptions {
  status: number;
  title: string;
  detail: string;
  type?: string;
  instance?: string;
  code?: string;
  invalidParams?: InvalidParam[];
  extensions?: Record<string, unknown>;
}

export function createProblemDetails(options: CreateProblemDetailsOptions): ProblemDetails {
  const {
    status,
    title,
    detail,
    type = 'about:blank',
    instance,
    code,
    invalidParams,
    extensions = {},
  } = options;

  return {
    type,
    title,
    status,
    detail,
    ...(instance !== undefined ? { instance } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(invalidParams !== undefined ? { invalidParams } : {}),
    ...extensions,
  };
}
