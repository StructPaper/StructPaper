export const DESKTOP_TITLEBAR_HEIGHT_PX = 38;

/**
 * Determines whether the active Next.js pathname is an editor workspace route
 * that should display manuscript controls (AutoSave toggle, title, save status).
 */
export function isEditorTitleBarRoute(pathname?: string | null): boolean {
  if (!pathname) {
    return false;
  }

  // Matches /papers/:id (where pathname !== '/papers')
  return pathname.startsWith('/papers/') && pathname !== '/papers';
}
