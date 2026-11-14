'use client';

import React from 'react';
import {
  SemanticElement,
  FloatingElementsDesignRules,
} from '@/types/template-builder';
import {
  ELEMENT_RENDERER_REGISTRY,
  FallbackElementRenderer,
} from './renderers';

export interface DynamicElementRendererProps {
  element: SemanticElement;
  primaryColor: string;
  floatingRules?: FloatingElementsDesignRules;
}

/**
 * Dynamic Element Renderer for A4 Live Preview
 * Dispatches to modular domain renderers via ELEMENT_RENDERER_REGISTRY (Strategy Pattern).
 * Completely eliminates monolithic file explosion and enables effortless extensibility.
 */
export const DynamicElementRenderer: React.FC<DynamicElementRendererProps> = ({
  element,
  primaryColor,
  floatingRules,
}) => {
  const RendererComponent =
    ELEMENT_RENDERER_REGISTRY[element.type] || FallbackElementRenderer;

  return (
    <RendererComponent
      element={element}
      primaryColor={primaryColor}
      floatingRules={floatingRules}
    />
  );
};
