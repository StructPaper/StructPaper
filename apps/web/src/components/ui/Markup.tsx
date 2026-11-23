'use client';

import React from 'react';
import { hasMarkup, markupToHtml } from '@/lib/inline-markup';

/** Text with <b>, <i>, <u>, <color=…> emphasis drawn as such (plain text is left as it is). The HTML is escaped by markupToHtml. */
export const Markup: React.FC<{ text: string | undefined | null; className?: string }> = ({ text, className }) => {
  const t = text ?? '';
  if (!hasMarkup(t)) return <span className={className}>{t}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: markupToHtml(t) }} />;
};
