'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

const shimmerVariants: Variants = {
  initial: { backgroundPosition: '-200% 0' },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 2,
      ease: 'linear',
      repeat: isTest ? 0 : Infinity,
    },
  },
};

/** The one shimmer gradient used across the app (papers, templates, permissions...). */
export const SHIMMER_STYLE: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
  backgroundSize: '200% 100%',
};

export interface ShimmerProps {
  /** Size and shape of the placeholder, e.g. "h-3.5 w-24 rounded-md". */
  className?: string;
}

/**
 * A single animated loading placeholder. Compose several of them to sketch the layout of the
 * content that is being loaded; same look as the shimmers of the papers and templates pages.
 */
export const Shimmer: React.FC<ShimmerProps> = ({ className = '' }) => (
  <motion.div
    aria-hidden="true"
    variants={isTest ? undefined : shimmerVariants}
    initial={isTest ? undefined : 'initial'}
    animate={isTest ? undefined : 'animate'}
    style={SHIMMER_STYLE}
    className={className}
  />
);
