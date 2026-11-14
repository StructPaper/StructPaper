'use client';

import React from 'react';
import { supportsCssFieldSizing } from '@/hooks/useSupportsCssFieldSizing';

export interface AutoResizeTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  autoFocus,
  onBlur,
  onKeyDown,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (supportsCssFieldSizing()) {
      if (el.style.height) {
        el.style.removeProperty('height');
      }
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  React.useEffect(() => {
    if (supportsCssFieldSizing()) return;
    const handleWindowResize = () => adjustHeight();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [adjustHeight]);

  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        if (!supportsCssFieldSizing()) {
          adjustHeight();
        }
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      rows={1}
      placeholder={placeholder}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      style={{ resize: 'none', overflow: 'hidden' }}
      className={`[field-sizing:content] ${className}`}
    />
  );
};
