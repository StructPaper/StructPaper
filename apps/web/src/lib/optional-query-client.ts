import { QueryClient, useQueryClient } from '@tanstack/react-query';

/** Stands in where no QueryClientProvider is mounted; queries that use it are disabled and never run. */
export const idleQueryClient = new QueryClient();

/** The surrounding QueryClient, or undefined when there is no provider (a few views render without one). */
export function useOptionalQueryClient(): QueryClient | undefined {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useQueryClient();
  } catch {
    return undefined;
  }
}
