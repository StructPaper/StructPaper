'use client';

import React, { useEffect, useState } from 'react';

const parseKeywords = (text: string): string[] =>
  text
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

interface KeywordsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string[];
  onChange: (keywords: string[]) => void;
}

/**
 * A comma-separated keyword field. The text you type is kept as typed (so a trailing comma or
 * space survives until the next word), while the parsed list is reported to the parent.
 * If the list changes from the outside (undo, load), the text follows it.
 */
export const KeywordsInput: React.FC<KeywordsInputProps> = ({ value, onChange, ...inputProps }) => {
  const [text, setText] = useState(() => value.join(', '));

  useEffect(() => {
    setText((current) => (sameList(parseKeywords(current), value) ? current : value.join(', ')));
  }, [value]);

  return (
    <input
      {...inputProps}
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseKeywords(e.target.value));
      }}
    />
  );
};
