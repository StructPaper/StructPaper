import React from 'react';
import { FloatingElementsDesignRules } from '@/types/template-builder';

/**
 * Parses in-text citation keys like [1], [2-4], (Nguyen et al., 2026) and renders with academic badges
 */
export function renderTextWithCitations(
  content: string,
  citeRules?: FloatingElementsDesignRules['citation'],
  primaryColor: string = '#2B74B7'
): React.ReactNode {
  if (!content) return null;
  const inTextColor = citeRules?.inTextColor || primaryColor || '#2B74B7';
  const inTextWeight = citeRules?.inTextWeight === 'normal' ? 400 : 700;
  const inTextPill = citeRules?.inTextPill ?? false;

  const parts = content.split(
    /(\[\d+(?:[,\s–-]\s*\d+)*\]|[¹²³⁴⁵⁶⁷⁸⁹⁰*°]+|\([A-Za-z\s&]+,\s*\d{4}\))/g
  );
  if (parts.length <= 1) return content;
  return parts.map((part, i) => {
    if (
      /^(\[\d+(?:[,\s–-]\s*\d+)*\]|[¹²³⁴⁵⁶⁷⁸⁹⁰*°]+|\([A-Za-z\s&]+,\s*\d{4}\))$/.test(
        part
      )
    ) {
      return (
        <span
          key={i}
          className={`font-sans ${part.startsWith('(') ? 'mx-1' : 'mx-0.5'} ${
            inTextPill
              ? 'bg-blue-50/80 px-1 py-0.5 rounded border border-blue-200 text-[85%]'
              : ''
          }`}
          style={{
            fontWeight: inTextWeight,
            color: inTextColor,
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}
