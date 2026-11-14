import React from 'react';
import {
  SemanticElement,
  FloatingElementsDesignRules,
} from '@/types/template-builder';

export interface ElementRendererProps {
  element: SemanticElement;
  primaryColor: string;
  floatingRules?: FloatingElementsDesignRules;
}

/**
 * Builds standard CSS properties from element styling & specialProps
 */
export function buildContainerStyle(
  styling: SemanticElement['styling'],
  specialProps: SemanticElement['specialProps']
): React.CSSProperties {
  return {
    fontFamily: styling.fontFamily,
    fontSize: `${styling.fontSize}pt`,
    fontWeight:
      styling.fontWeight === 'extrabold'
        ? 800
        : styling.fontWeight === 'black'
          ? 900
          : styling.fontWeight === 'bold'
            ? 700
            : styling.fontWeight === 'semibold'
              ? 600
              : 400,
    fontStyle: styling.fontStyle,
    color: styling.textColor,
    textAlign: styling.textAlign,
    lineHeight: styling.lineHeight,
    backgroundColor:
      styling.backgroundColor === 'transparent' ? 'transparent' : styling.backgroundColor,
    borderLeft:
      styling.borderStyle === 'left-solid'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : styling.borderStyle === 'all-borders'
          ? `${styling.borderWidth}px solid ${styling.borderColor}`
          : 'none',
    borderTop:
      styling.borderStyle === 'all-borders' || styling.borderStyle === 'top-bottom'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    borderBottom:
      styling.borderStyle === 'all-borders' || styling.borderStyle === 'top-bottom'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    borderRight:
      styling.borderStyle === 'all-borders'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    paddingTop: specialProps?.isContinuation ? 0 : `${styling.padding.top * 1.5}px`,
    paddingBottom: `${styling.padding.top * 1.5}px`,
    paddingLeft: `${(styling.padding.left || 0) * 1.5}px`,
    paddingRight: `${(styling.padding.right || 0) * 1.5}px`,
    borderRadius: `${styling.borderRadius}px`,
    marginTop: specialProps?.isContinuation ? 0 : `${styling.margin.top}px`,
    marginBottom: `${styling.margin.bottom}px`,
  };
}

export { renderTextWithCitations } from './renderUtils';
