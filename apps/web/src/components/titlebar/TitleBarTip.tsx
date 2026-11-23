import React from 'react';

/**
 * A label under a title-bar icon on hover and keyboard focus. The browser's own `title` tooltip is slow, can be hidden by the window
 * chrome of the desktop app, and does not show on a touch screen; this one appears at once and stays inside the window.
 */
export const TitleBarTip: React.FC<{ label: string; children: React.ReactNode; align?: 'center' | 'right' }> = ({ label, children, align = 'center' }) => (
  <span className="relative inline-flex group/tip" data-no-drag="true">
    {children}
    <span
      role="tooltip"
      className={`pointer-events-none absolute top-full mt-1.5 z-50 whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg opacity-0 translate-y-0.5 transition-all duration-150 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-hover/tip:delay-300 group-focus-within/tip:opacity-100 ${
        align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
      }`}
    >
      {label}
    </span>
  </span>
);
