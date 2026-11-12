'use client';

import React from 'react';
import { useCapabilities } from '@structpaper/platform';
import { DESKTOP_TITLEBAR_HEIGHT_PX } from './titlebar-routes';
import { DesktopTitleBar } from './DesktopTitleBar';

export interface DesktopChromeShellProps {
  children: React.ReactNode;
}

/**
 * Coordinates application chrome spacing across all routes
 * via `--titlebar-height`, applying a 38px offset for both Desktop and Web builds.
 */
export const DesktopChromeShell: React.FC<DesktopChromeShellProps> = ({ children }) => {
  const titleBarHeight = `${DESKTOP_TITLEBAR_HEIGHT_PX}px`;

  return (
    <div
      style={{ '--titlebar-height': titleBarHeight } as React.CSSProperties}
      className="pt-[var(--titlebar-height)] min-h-screen bg-[#F8F9FA]"
    >
      <DesktopTitleBar />
      {children}
    </div>
  );
};
