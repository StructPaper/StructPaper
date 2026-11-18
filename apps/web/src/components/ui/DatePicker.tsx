'use client';
import { useReadOnly } from './read-only';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
export interface DatePickerProps {
  value: string; // e.g. "14-06-2025" or "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  minWidth?: string;
  align?: 'auto' | 'left' | 'right';
  className?: string;
}

// Helpers for date parsing and formatting (DD-MM-YYYY)
function parseDateString(str: string): Date | null {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  
  // Format DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  // Format YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  return null;
}

function formatDateToDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

const MONTH_NAMES_VI = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const WEEKDAY_NAMES_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'DD-MM-YYYY',
  disabled: disabledProp = false,
  minWidth = 'w-full',
  align: alignProp = 'auto',
  className = '',
}) => {
  const disabled = useReadOnly() || disabledProp;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'day' | 'month' | 'year'>('day');

  // Automatic smart placement (flip up/down and left/right based on viewport & container)
  const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
  const [align, setAlign] = useState<'left' | 'right'>('left');

  // Currently selected date
  const parsedValue = parseDateString(value);

  // Month and year currently viewed in the calendar
  const [viewDate, setViewDate] = useState<Date>(() => parsedValue || new Date());

  // Keep viewDate in sync when value changes externally
  useEffect(() => {
    if (parsedValue) {
      setViewDate(parsedValue);
    }
  }, [value]);

  // Measure position to determine if calendar should open above or below, and left or right
  const updatePlacement = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popupHeight = 350; // Approx height of calendar popup in pixels
    const popupWidth = 288;  // w-72 = 288px

    // Space from trigger button to viewport edges
    const spaceBelowViewport = window.innerHeight - rect.bottom;
    const spaceAboveViewport = rect.top;

    // Check closest scrollable/overflow container if one exists
    let spaceBelowScrollParent = Infinity;
    let spaceAboveScrollParent = Infinity;
    let boundaryLeft = 0;
    let boundaryRight = window.innerWidth;

    let parent = containerRef.current.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        style.overflowX === 'auto' ||
        style.overflowX === 'scroll' ||
        style.overflow === 'auto' ||
        style.overflow === 'scroll' ||
        style.overflow === 'hidden'
      ) {
        const pRect = parent.getBoundingClientRect();
        spaceBelowScrollParent = pRect.bottom - rect.bottom;
        spaceAboveScrollParent = rect.top - pRect.top;
        boundaryLeft = Math.max(boundaryLeft, pRect.left);
        boundaryRight = Math.min(boundaryRight, pRect.right);
        break;
      }
      parent = parent.parentElement;
    }

    const effectiveSpaceBelow = Math.min(spaceBelowViewport, spaceBelowScrollParent);
    const effectiveSpaceAbove = Math.min(spaceAboveViewport, spaceAboveScrollParent);

    // If space below is not enough for popup (~350px) and there is more space above,
    // OR if effectiveSpaceBelow is less than 320px and above has room (> 200px),
    // OR if the element is in the lower half of the viewport and below space is tight:
    const shouldOpenTop =
      (effectiveSpaceBelow < popupHeight && effectiveSpaceAbove > effectiveSpaceBelow) ||
      (effectiveSpaceBelow < 320 && effectiveSpaceAbove > 200) ||
      (spaceBelowViewport < 380 && spaceAboveViewport > spaceBelowViewport);

    setPlacement(shouldOpenTop ? 'top' : 'bottom');

    // Horizontal alignment detection:
    // When left-aligned (left-0), the popup reaches rect.left + popupWidth.
    // If that overflows boundaryRight (e.g. into split divider or container edge), flip to right-0!
    const availableRight = boundaryRight - rect.left;
    const availableLeft = rect.right - boundaryLeft;

    if (availableRight < popupWidth && availableLeft >= popupWidth) {
      setAlign('right');
    } else if (availableRight < popupWidth && availableLeft > availableRight) {
      setAlign('right');
    } else if (availableLeft < popupWidth && availableRight >= popupWidth) {
      setAlign('left');
    } else {
      setAlign(availableLeft > availableRight ? 'right' : 'left');
    }
  }, []);

  // Update placement immediately when opened, and on window scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;

    updatePlacement();

    const handleScrollOrResize = () => {
      updatePlacement();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePlacement]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setMode('day');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setMode('day');
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Navigation handlers
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePlacement();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setMode('day');
    }
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: number, monthOffset: number = 0) => {
    const targetMonth = viewMonth + monthOffset;
    const selected = new Date(viewYear, targetMonth, day);
    onChange(formatDateToDDMMYYYY(selected));
    setIsOpen(false);
    setMode('day');
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    onChange(formatDateToDDMMYYYY(today));
    setViewDate(today);
    setIsOpen(false);
    setMode('day');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Generate 42 calendar grid days (Monday as first day of week)
  const calendarDays = (() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: { day: number; monthOffset: number; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] = [];

    // Previous month tail
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({
        day: d,
        monthOffset: -1,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
      });
    }

    // Current month days
    const now = new Date();
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const isToday =
        now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === i;
      const isSelected =
        parsedValue !== null &&
        parsedValue.getFullYear() === viewYear &&
        parsedValue.getMonth() === viewMonth &&
        parsedValue.getDate() === i;

      days.push({
        day: i,
        monthOffset: 0,
        isCurrentMonth: true,
        isToday,
        isSelected,
      });
    }

    // Next month head to fill remaining cells (up to 42 for consistent grid height)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        monthOffset: 1,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
      });
    }

    return days;
  })();

  // Years list for quick year navigation (current year +/- 15)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 30 }, (_, i) => currentYear - 15 + i);

  // Position classes based on detected placement and alignment
  const effectiveAlign = alignProp !== 'auto' ? alignProp : align;
  const positionClasses = `${placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
    effectiveAlign === 'right' ? 'right-0' : 'left-0'
  }`;

  const yOffset = placement === 'top' ? 6 : -6;

  return (
    <div ref={containerRef} className={`relative flex flex-col ${minWidth} ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-zinc-500 block mb-1 select-none">
          {label}
        </label>
      )}

      {/* Trigger Button - Clean compact input style matching original design */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-1 p-2 rounded-xl border border-zinc-200 text-xs text-zinc-900 bg-white transition-all select-none cursor-pointer group hover:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 ${
          isOpen ? 'ring-4 ring-blue-200 border-blue-300' : ''
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-zinc-50' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-left">
          <CalendarIcon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 group-hover:text-zinc-700 transition-colors" />
          <span className={`truncate ${value ? 'text-zinc-900 font-semibold' : 'text-zinc-400'}`}>
            {value || placeholder}
          </span>
        </div>

        {/* Clear button if has value */}
        {value && !disabled && (
          <span
            onClick={handleClear}
            title="Xóa ngày"
            className="p-0.5 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors flex-shrink-0 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Calendar Dropdown / Dropup Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: yOffset }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: yOffset }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`absolute z-50 bg-white rounded-2xl border border-zinc-200 shadow-2xl p-3 w-72 min-w-[280px] max-w-[calc(100vw-32px)] select-none ${positionClasses}`}
            style={{
              backdropFilter: 'blur(16px)',
              boxShadow: '0 16px 40px -6px rgba(0, 0, 0, 0.18), 0 4px 16px -2px rgba(0, 0, 0, 0.08)',
            }}
          >
            {/* Header: Month / Year / Nav arrows */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {/* Month switch */}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'month' ? 'day' : 'month')}
                  className="px-2 py-1 rounded-lg text-xs font-extrabold text-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  {MONTH_NAMES_VI[viewMonth]}
                </button>

                {/* Year switch */}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'year' ? 'day' : 'year')}
                  className="px-2 py-1 rounded-lg text-xs font-extrabold text-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  {viewYear}
                </button>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mode: Month selector */}
            {mode === 'month' && (
              <div className="grid grid-cols-3 gap-1.5 py-1">
                {MONTH_NAMES_VI.map((mName, mIdx) => (
                  <button
                    key={mIdx}
                    type="button"
                    onClick={() => {
                      setViewDate(new Date(viewYear, mIdx, 1));
                      setMode('day');
                    }}
                    className={`py-2 text-xs rounded-xl font-bold transition-all ${
                      viewMonth === mIdx
                        ? 'bg-[#1A1A1A] text-white shadow-2xs'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {mName}
                  </button>
                ))}
              </div>
            )}

            {/* Mode: Year selector */}
            {mode === 'year' && (
              <div className="grid grid-cols-4 gap-1 py-1 max-h-48 overflow-y-auto no-scrollbar">
                {yearOptions.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewDate(new Date(y, viewMonth, 1));
                      setMode('day');
                    }}
                    className={`py-1.5 text-xs rounded-xl font-bold transition-all ${
                      viewYear === y
                        ? 'bg-[#1A1A1A] text-white shadow-2xs'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* Mode: Normal Day Calendar */}
            {mode === 'day' && (
              <>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {WEEKDAY_NAMES_VI.map((w) => (
                    <div key={w} className="text-[10px] font-bold text-zinc-400 py-0.5">
                      {w}
                    </div>
                  ))}
                </div>

                {/* Day cells grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarDays.map((dObj, idx) => {
                    const isSelected = dObj.isSelected;
                    const isCurrent = dObj.isCurrentMonth;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectDay(dObj.day, dObj.monthOffset)}
                        className={`w-8 h-8 mx-auto rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1A1A1A] text-white font-extrabold shadow-2xs scale-105'
                            : isCurrent
                            ? dObj.isToday
                              ? 'bg-[#D9F99D] text-[#14532D] font-black border border-emerald-400'
                              : 'text-zinc-800 font-semibold hover:bg-zinc-100'
                            : 'text-zinc-300 font-normal hover:bg-zinc-50'
                        }`}
                      >
                        {dObj.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Footer shortcuts */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-100 text-[11px]">
              <button
                type="button"
                onClick={handleSelectToday}
                className="font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
              >
                Hôm nay
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setMode('day');
                }}
                className="font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
