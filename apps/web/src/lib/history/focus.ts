import type { FocusTarget } from './editor-history';
import type { EditorTab } from './paper-content';

/** Attribute on the editor's tab panel: tells which tab an element belongs to. */
export const PANEL_ATTR = 'data-editor-panel';
const SECTION_CARD_PREFIX = 'section-card-';

/** Things an author types into. A rich-text block (TipTap) is a contenteditable. */
const EDITABLE = 'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=button]):not([type=range]),textarea,select,[contenteditable="true"]';

const panelOf = (el: Element | null): HTMLElement | null => (el?.closest?.(`[${PANEL_ATTR}]`) as HTMLElement | null) ?? null;
const cardOf = (el: Element | null): HTMLElement | null => (el?.closest?.(`[id^="${SECTION_CARD_PREFIX}"]`) as HTMLElement | null) ?? null;

const keyOf = (el: HTMLElement): string | undefined => el.id || el.getAttribute('name') || el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || undefined;

/**
 * Describes the field that has the cursor, in a way that survives re-rendering: the tab, the block it is in,
 * its position among the fields there, a distinctive attribute, and the selection inside it.
 * Null when the cursor is not in the editor's panels.
 */
export function describeFocus(el: Element | null): FocusTarget | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const panel = panelOf(el);
  if (!panel) return null;
  const tab = panel.getAttribute(PANEL_ATTR) as EditorTab;
  const card = cardOf(el);
  const scope: ParentNode = card ?? panel;
  const fields = Array.from(scope.querySelectorAll<HTMLElement>(EDITABLE));
  const target = el.matches(EDITABLE) ? el : (el.closest(EDITABLE) as HTMLElement | null);
  if (!target) {
    return card ? { tab, sectionId: card.id.slice(SECTION_CARD_PREFIX.length) } : null;
  }
  const nth = fields.indexOf(target);
  const out: FocusTarget = { tab, nth: nth === -1 ? undefined : nth, fieldKey: keyOf(target) };
  if (card) out.sectionId = card.id.slice(SECTION_CARD_PREFIX.length);
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try {
      if (target.selectionStart !== null && target.selectionEnd !== null) out.selection = { start: target.selectionStart, end: target.selectionEnd };
    } catch {
      /* number/email inputs have no selection */
    }
  }
  return out;
}

/** Finds the field again after the tab and block have been shown. */
export function findField(target: FocusTarget): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const panel = document.querySelector<HTMLElement>(`[${PANEL_ATTR}="${target.tab}"]`);
  if (!panel) return null;
  let scope: ParentNode = panel;
  if (target.sectionId) {
    const card = document.getElementById(`${SECTION_CARD_PREFIX}${target.sectionId}`);
    if (!card) return null;
    scope = card;
  }
  const fields = Array.from(scope.querySelectorAll<HTMLElement>(EDITABLE)).filter((f) => !f.hasAttribute('disabled') && !f.hasAttribute('readonly'));
  if (fields.length === 0) return target.sectionId ? (scope as HTMLElement) : null;
  if (target.fieldKey) {
    const byKey = fields.filter((f) => keyOf(f) === target.fieldKey);
    if (byKey.length === 1) return byKey[0];
  }
  return fields[Math.min(target.nth ?? 0, fields.length - 1)];
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Puts the cursor where `target` says, once the tab (and the block, when it is one) is on screen: it keeps looking for
 * the field for a short while because the tab may still be mounting. Scrolls it into view and restores the selection
 * (the end of the text for a rich-text block). Returns whether a field took the focus.
 */
export async function focusTarget(target: FocusTarget | null, timeoutMs = 1200): Promise<boolean> {
  if (!target || typeof document === 'undefined') return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const el = findField(target);
    if (el) {
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      el.focus?.({ preventScroll: true });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        try {
          const len = el.value.length;
          const sel = target.selection;
          el.setSelectionRange(Math.min(sel?.start ?? len, len), Math.min(sel?.end ?? len, len));
        } catch {
          /* not selectable */
        }
      } else if (el.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      return true;
    }
    await wait(40);
  }
  return false;
}
