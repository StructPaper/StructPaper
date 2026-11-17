'use client';

import React from 'react';
import type { Capability } from '@structpaper/contracts';
import { useAccess, type Decision } from './access';

export interface GateProps {
  /** Capability (or list: all of them are required) that must be granted. */
  capability: Capability | Capability[];
  /** With a list: true = at least one is enough. */
  any?: boolean;
  /**
   * 'hide' (default): render nothing / `fallback` when denied.
   * 'disable': always render; `children` must be a function receiving the Decision, so the child
   *            can show itself disabled with the reason.
   */
  mode?: 'hide' | 'disable';
  /** Shown instead of the children when denied (mode 'hide'). */
  fallback?: React.ReactNode;
  /** Shown while the capabilities are still being loaded (default: nothing, i.e. default deny). */
  loadingFallback?: React.ReactNode;
  children: React.ReactNode | ((decision: Decision) => React.ReactNode);
}

/**
 * Shows its children only when the capability is granted. Put it as HIGH as possible (around a
 * page, a tab, a group of buttons) instead of sprinkling checks on every element, and keep the
 * children "dumb" (they receive data through props). It is user experience, not security.
 */
export function Gate({
  capability,
  any = false,
  mode = 'hide',
  fallback = null,
  loadingFallback = null,
  children,
}: GateProps): React.ReactElement | null {
  const access = useAccess();
  const list = Array.isArray(capability) ? capability : [capability];
  const allowed = any ? access.canAny(...list) : access.canAll(...list);
  const decision: Decision = allowed
    ? { allowed: true }
    : access.status === 'ready'
      ? { allowed: false, reason: 'NO_PERMISSION' }
      : { allowed: false, reason: 'LOADING' };

  if (mode === 'disable') {
    return <>{typeof children === 'function' ? children(decision) : children}</>;
  }

  if (!allowed) {
    return <>{access.status === 'ready' ? fallback : loadingFallback}</>;
  }

  return <>{typeof children === 'function' ? children(decision) : children}</>;
}
