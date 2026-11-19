export const DESKTOP_TITLEBAR_HEIGHT_PX = 38;

/**
 * Determines whether the active Next.js pathname is an editor workspace route
 * that should display manuscript controls (AutoSave toggle, title, save status).
 */
export function isEditorTitleBarRoute(pathname?: string | null): boolean {
  if (!pathname) {
    return false;
  }

  // Matches /papers/:id only: /papers/:id/history has its own title bar content
  return /^\/papers\/[^/]+\/?$/.test(pathname);
}

/** The template page of one journal (or the new-journal page): the title bar shows the journal instead of a paper. */
export function isJournalDetailRoute(pathname?: string | null): boolean {
  return !!pathname && /^\/templates\/journal\/[^/]+\/?$/.test(pathname);
}

/** The version history page of a paper: the title bar shows what it is and the way back to the editor. */
export function isPaperHistoryRoute(pathname?: string | null): boolean {
  return !!pathname && /^\/papers\/[^/]+\/history\/?$/.test(pathname);
}
