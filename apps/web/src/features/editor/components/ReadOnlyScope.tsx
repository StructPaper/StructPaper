'use client';

import React, { useEffect, useRef } from 'react';
import { ReadOnlyProvider } from '@/components/ui/read-only';

/** Locks every native field under `root` (and keeps doing so for fields rendered later). */
export function lockFields(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('input, textarea').forEach((el) => {
    const field = el as HTMLInputElement | HTMLTextAreaElement;
    if (field instanceof HTMLInputElement && ['checkbox', 'radio', 'file', 'button', 'submit'].includes(field.type)) {
      field.disabled = true;
    } else if (!field.readOnly) {
      field.readOnly = true;
    }
  });
  root.querySelectorAll<HTMLElement>('select').forEach((el) => ((el as HTMLSelectElement).disabled = true));
  root.querySelectorAll<HTMLElement>('[contenteditable="true"], [contenteditable=""]').forEach((el) =>
    el.setAttribute('contenteditable', 'false'),
  );
  // click-to-edit areas leave the keyboard order too
  root.querySelectorAll<HTMLElement>('[tabindex="0"]:not(button):not(a)').forEach((el) => el.setAttribute('tabindex', '-1'));
}

const EDITABLE = 'input, textarea, select, [contenteditable]';
const INTERACTIVE = 'button, a, [role="tab"], summary';

/** Nothing in a read-only area may take focus for typing, or switch into an editing mode. */
export function guardEditing(root: HTMLElement): () => void {
  const blurEditable = (e: Event) => {
    const t = e.target as HTMLElement | null;
    if (t?.matches?.(EDITABLE)) t.blur();
  };
  const swallowEditTrigger = (e: Event) => {
    const t = e.target as HTMLElement | null;
    const trigger = t?.closest?.('[tabindex]');
    if (trigger && trigger !== root && root.contains(trigger) && !trigger.querySelector(EDITABLE) && !t!.closest(INTERACTIVE) && !t!.matches(EDITABLE)) e.stopPropagation();
  };
  root.addEventListener('focusin', blurEditable, true);
  (['click', 'mousedown', 'focusin', 'dblclick'] as const).forEach((type) => root.addEventListener(type, swallowEditTrigger, true));
  return () => {
    root.removeEventListener('focusin', blurEditable, true);
    (['click', 'mousedown', 'focusin', 'dblclick'] as const).forEach((type) => root.removeEventListener(type, swallowEditTrigger, true));
  };
}

/**
 * Wraps editor content that must not be changed (view-only access).
 *  - native inputs / textareas become read-only, rich-text areas stop being editable;
 *  - shared controls (Select, DatePicker, ...) lock through ReadOnlyProvider;
 *  - anything marked `data-edit-only` (add, delete, move, paste buttons) is hidden by CSS.
 * This is a convenience layer: the API refuses the writes anyway.
 */
export const ReadOnlyScope: React.FC<{ readOnly: boolean; className?: string; children: React.ReactNode }> = ({
  readOnly,
  className,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!readOnly || !root) return;
    lockFields(root);
    const observer = new MutationObserver(() => lockFields(root));
    observer.observe(root, { childList: true, subtree: true });
    const release = guardEditing(root);
    return () => {
      observer.disconnect();
      release();
    };
  }, [readOnly]);

  return (
    <ReadOnlyProvider readOnly={readOnly}>
      <div ref={ref} data-readonly={readOnly ? 'true' : undefined} className={className}>
        {children}
      </div>
    </ReadOnlyProvider>
  );
};
