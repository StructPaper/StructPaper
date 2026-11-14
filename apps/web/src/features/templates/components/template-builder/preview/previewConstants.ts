/**
 * Standard paper sizes and physical dimension constants for Live A4 Preview
 */

export const STANDARD_PAPER_SIZES: Record<string, { width: number; height: number; name: string }> = {
  A4: { width: 210, height: 297, name: 'A4' },
  A5: { width: 148, height: 210, name: 'A5' },
  B5: { width: 176, height: 250, name: 'B5' },
  Letter: { width: 215.9, height: 279.4, name: 'US Letter' },
  Legal: { width: 215.9, height: 355.6, name: 'US Legal' },
  VNUHCM_Letter: { width: 216.15, height: 279.4, name: 'VNUHCM (8.51" x 11")' },
};

/**
 * Standard web DPI conversion scale: 96 DPI / 25.4 mm = 3.7795 px per mm
 */
export const MM_TO_PX = 96 / 25.4;
