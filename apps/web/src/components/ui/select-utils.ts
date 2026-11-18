import type { Variants } from 'framer-motion';

// Utility to remove Vietnamese diacritics for search matching
export function stripVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Framer motion variants for smooth dropdown animation
// `custom` = true when the popover opens upwards (it then slides in from below instead of above)
export const dropdownVariants: Variants = {
  hidden: (openUp: boolean) => ({
    opacity: 0,
    scale: 0.97,
    y: openUp ? 8 : -8,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
    },
  }),
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: 'easeOut',
    },
  },
  exit: (openUp: boolean) => ({
    opacity: 0,
    scale: 0.97,
    y: openUp ? 8 : -8,
    transition: {
      duration: 0.18,
      ease: 'easeIn',
    },
  }),
};

export const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.015,
    },
  },
};

export const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 450,
      damping: 28,
      mass: 0.7,
    },
  },
};
