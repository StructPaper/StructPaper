'use client';

import React from 'react';
import { SemanticElement } from '@/types/template-builder';
import { ElementStudioMain } from '../element-engine';

import { ArrowLeft, ArrowRight } from 'lucide-react';

interface Step3DeepStylingProps {
  elements: SemanticElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
  onUpdateElement: (id: string, updated: Partial<SemanticElement>) => void;
  primaryColor: string;
  onNavigateToBack?: () => void;
  onNavigateForward?: () => void;
}

/**
 * Step 4: Deep Styling & Finite Attributes Studio (SciSpace Architecture Model)
 * Pure separation of semantic elements and structured attribute styling:
 * - Typography (Font Family, Size pt, Weight, Style, Transform, Color, Line Height, Letter Spacing)
 * - Spacing & Alignment (Margin Top/Bottom pt, Padding mm, Text Alignment, Indents)
 * - Layout Scope (Column Span All vs Single, Display Mode)
 * - Decorations (4-side Borders, Width pt, Style, Color, Background, Radius px)
 * - Numbering Scheme & Academic Citations (Roman, Arabic, Decimal, Alphabet, Vancouver, IEEE, APA)
 */
export const Step3DeepStyling: React.FC<Step3DeepStylingProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  primaryColor,
  onNavigateToBack,
  onNavigateForward,
}) => {
  return (
    <div className="space-y-4">
      <ElementStudioMain
        elements={elements}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        onUpdateElement={onUpdateElement}
        primaryColor={primaryColor}
      />
    </div>
  );
};
