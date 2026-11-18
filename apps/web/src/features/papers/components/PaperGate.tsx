'use client';

import React from 'react';
import type { Decision } from '@/lib/access';
import type { PaperAccess, PaperAction } from '../access';

interface PaperGateProps {
  access: PaperAccess;
  /** What is needed; a list needs ALL of it unless `any` is set. */
  allow: PaperAction | PaperAction[];
  any?: boolean;
  /**
   * 'hide' (default): render children only when allowed.
   * 'disable': always render and hand the decision to the child, so it can explain itself.
   */
  mode?: 'hide' | 'disable';
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode | ((decision: Decision) => React.ReactNode);
}

/**
 * Shows its children only when the user may do `allow` with this paper.
 * The paper twin of <Gate capability>: hiding never protects data, the API still checks.
 */
export const PaperGate: React.FC<PaperGateProps> = ({
  access,
  allow,
  any = false,
  mode = 'hide',
  fallback = null,
  loadingFallback,
  children,
}) => {
  const actions = Array.isArray(allow) ? allow : [allow];
  const decisions = actions.map((a) => access.explain(a));
  const allowed = any ? decisions.some((d) => d.allowed) : decisions.every((d) => d.allowed);
  const decision: Decision = allowed ? { allowed: true } : (decisions.find((d) => !d.allowed) as Decision);

  if (mode === 'disable') return <>{typeof children === 'function' ? children(decision) : children}</>;
  if (allowed) return <>{typeof children === 'function' ? children(decision) : children}</>;
  if (access.status === 'loading' && loadingFallback !== undefined) return <>{loadingFallback}</>;
  return <>{fallback}</>;
};
