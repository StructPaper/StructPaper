'use client';

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  stripVietnameseDiacritics,
  dropdownVariants,
  listVariants,
  itemVariants,
} from './select-utils';
import { useDropdownPlacement, LIST_MAX_HEIGHT, SEARCH_BOX_HEIGHT } from './useDropdownPlacement';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  badge?: string | React.ReactNode;
  icon?: React.ReactNode;
  color?: string; // Optional color indicator swatch/dot
  disabled?: boolean;
}

export interface SelectProps<T extends string | number = string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  label?: string;
  labelClassName?: string;
  helperText?: string;
  error?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'pill' | 'subtle' | 'liquid-glass' | 'slate' | 'clean' | 'flat-white' | 'white-shadow-4' | 'eatzy-inner' | 'custom';
  align?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  dropdownClassName?: string;
  id?: string;
  name?: string;
  renderOption?: (option: SelectOption<T>, isSelected: boolean) => React.ReactNode;
  renderTrigger?: (selectedOption: SelectOption<T> | undefined, isOpen: boolean) => React.ReactNode;
}

export function Select<T extends string | number = string>({
  options,
  value,
  onChange,
  placeholder = 'Chọn một tùy chọn...',
  label,
  labelClassName = '',
  helperText,
  error,
  size = 'md',
  variant = 'default',
  align = 'left',
  fullWidth = true,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  className = '',
  dropdownClassName = '',
  id,
  name,
  renderOption,
  renderTrigger,
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const queryNorm = stripVietnameseDiacritics(searchQuery.trim());
    return options.filter((opt) => {
      const labelNorm = stripVietnameseDiacritics(opt.label);
      const descNorm = opt.description ? stripVietnameseDiacritics(opt.description) : '';
      const badgeNorm = typeof opt.badge === 'string' ? stripVietnameseDiacritics(opt.badge) : '';
      return (
        labelNorm.includes(queryNorm) ||
        descNorm.includes(queryNorm) ||
        badgeNorm.includes(queryNorm) ||
        String(opt.value).toLowerCase().includes(queryNorm)
      );
    });
  }, [options, searchQuery]);

  const popoverRef = useRef<HTMLDivElement>(null);
  const placement = useDropdownPlacement({
    isOpen,
    triggerRef,
    align,
    optionCount: filteredOptions.length,
    searchable,
  });

  // Handle outside click to close
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);
      if (containerRef.current && !insideTrigger && !insidePopover) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Focus search input or listbox item when opening
  useEffect(() => {
    if (isOpen) {
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
      const selectedIdx = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    } else {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [isOpen, searchable, filteredOptions, value]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listboxRef.current && highlightedIndex >= 0) {
      const highlightedEl = listboxRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      onChange(option.value);
      setIsOpen(false);
      setSearchQuery('');
      triggerRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          e.preventDefault();
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            const next = prev + 1;
            return next < filteredOptions.length ? next : 0;
          });
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) => {
            const next = prev - 1;
            return next >= 0 ? next : filteredOptions.length - 1;
          });
        }
        break;

      case 'Escape':
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
          setSearchQuery('');
          if (e.key === 'Escape') {
            e.preventDefault();
            triggerRef.current?.focus();
          }
        }
        break;
    }
  };

  // Size styling tokens
  const sizeClasses = {
    xs: 'text-[11px] py-1 px-2 min-h-[26px]',
    sm: 'text-xs py-1.5 px-2.5 min-h-[32px]',
    md: 'text-xs py-2 px-3 min-h-[36px]',
    lg: 'text-sm py-2 px-3.5 min-h-[40px]',
  }[size];

  // Variant styling tokens
  const variantClasses = {
    default: 'bg-white border-[#E8E8EE] hover:border-zinc-400 focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/30 rounded-2xl shadow-xs font-semibold',
    pill: 'bg-white border-[#E8E8EE] hover:border-zinc-400 focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/30 rounded-full shadow-xs font-semibold',
    subtle: 'bg-zinc-50 border-[#E8E8EE] hover:bg-white hover:border-zinc-400 focus:bg-white focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/30 rounded-2xl shadow-xs font-semibold',
    slate: 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300 focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 rounded-xl shadow-2xs text-slate-900 font-semibold',
    clean: 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 rounded-xl shadow-2xs text-slate-900 font-semibold',
    'flat-white': 'bg-white hover:bg-slate-50/70 border-0 shadow-none focus:ring-2 focus:ring-[#78C841]/30 rounded-xl text-slate-900 font-semibold',
    'white-shadow-4': 'bg-white hover:bg-slate-50/70 border-0 shadow-[0_0_12px_rgba(0,0,0,0.08),0_0_3px_rgba(0,0,0,0.04)] hover:shadow-[0_0_16px_rgba(0,0,0,0.12),0_0_4px_rgba(0,0,0,0.06)] focus:ring-2 focus:ring-[#78C841]/30 rounded-xl text-slate-900 font-semibold',
    'liquid-glass': 'bg-white/45 hover:bg-white/75 backdrop-blur-md border border-white/60 shadow-[inset_0_0_14px_8px_rgba(255,255,255,0.85)] text-[#1A1A1A] rounded-2xl focus:border-[#78C841]/50 focus:ring-2 focus:ring-[#78C841]/20 font-semibold',
    'eatzy-inner': 'bg-slate-50/50 backdrop-blur-sm border-2 border-white hover:border-zinc-200/80 focus:border-[#78C841]/20 rounded-2xl shadow-eatzy-inner hover:shadow-eatzy-inner-hover text-zinc-900 font-semibold',
    custom: '',
  }[variant];

  const hasBorder = variant !== 'custom' && variant !== 'flat-white' && variant !== 'white-shadow-4' && variant !== 'eatzy-inner';

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${fullWidth ? 'w-full' : ''} ${
        isOpen ? 'z-[100]' : 'z-10'
      }`}
      onKeyDown={handleKeyDown}
    >
      {/* Optional Top Label */}
      {label && (
        <label
          htmlFor={selectId}
          className={`block text-xs font-bold text-zinc-600 mb-1 tracking-tight ${labelClassName}`}
        >
          {label}
        </label>
      )}

      {/* Hidden input for form integration */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        style={variant === 'eatzy-inner' ? { boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.08)' } : undefined}
        className={`group relative flex items-center justify-between gap-1.5 transition-all text-left font-semibold cursor-pointer ${
          hasBorder ? 'border' : 'border-0'
        } ${fullWidth ? 'w-full' : ''} ${
          variant === 'custom' ? '' : sizeClasses
        } ${variantClasses} ${
          disabled
            ? 'opacity-60 bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400'
            : 'text-slate-900'
        } ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''} ${className}`}
      >
        {renderTrigger ? (
          renderTrigger(selectedOption, isOpen)
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
            {selectedOption ? (
              <>
                {selectedOption.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10 shadow-2xs"
                    style={{ backgroundColor: selectedOption.color }}
                  />
                )}
                {selectedOption.icon && (
                  <span className="shrink-0 text-zinc-500">{selectedOption.icon}</span>
                )}
                <span className="truncate text-slate-900 font-semibold text-xs">
                  {selectedOption.label}
                </span>
                {selectedOption.badge && (
                  <span
                    className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      variant === 'liquid-glass'
                        ? 'bg-[#D9F99D] text-[#14532D]'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}
                  >
                    {selectedOption.badge}
                  </span>
                )}
              </>
            ) : (
              <span className="text-zinc-500 font-medium text-xs truncate">{placeholder}</span>
            )}
          </div>
        )}

        <motion.span
          animate={isTest ? undefined : { rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 flex items-center justify-center text-zinc-400 group-hover:text-zinc-800"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 ${isOpen ? 'text-[#78C841]' : 'text-slate-400'}`}
            aria-hidden="true"
          />
        </motion.span>
      </button>

      {/* Helper text or Error message */}
      {error ? (
        <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-zinc-400">{helperText}</p>
      ) : null}

      {/* Animated Dropdown Menu Popover with AnimatePresence */}
      {typeof document !== 'undefined' &&
        createPortal(
      <AnimatePresence>
        {isOpen && placement && (
          <motion.div
            ref={popoverRef}
            key="dropdown-popover"
            custom={placement.openUp}
            variants={isTest ? undefined : dropdownVariants}
            initial={isTest ? undefined : 'hidden'}
            animate={isTest ? undefined : 'visible'}
            exit={isTest ? undefined : 'exit'}
            data-placement={placement.openUp ? 'top' : 'bottom'}
            style={{
              position: 'fixed',
              top: placement.top,
              bottom: placement.bottom,
              left: placement.left,
              width: placement.width,
            }}
            className={`z-[10050] min-w-[180px] bg-white border border-slate-200/90 shadow-2xl shadow-black/15 rounded-xl overflow-hidden ${
              placement.openUp ? 'origin-bottom' : 'origin-top'
            } ${dropdownClassName}`}
          >
            {/* Search box if enabled */}
            {searchable && (
              <div className="p-2 border-b border-zinc-100 bg-zinc-50/50">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full text-xs pl-8 pr-7 py-1.5 bg-white border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options Listbox with Staggered Cascading Children */}
            <motion.ul
              ref={listboxRef}
              variants={isTest ? undefined : listVariants}
              initial={isTest ? undefined : 'hidden'}
              animate={isTest ? undefined : 'visible'}
              role="listbox"
              tabIndex={-1}
              aria-label={label || placeholder}
              style={{
                maxHeight: placement
                  ? Math.max(Math.min(LIST_MAX_HEIGHT, placement.maxHeight - (searchable ? SEARCH_BOX_HEIGHT : 0)), 72)
                  : undefined,
              }}
              className="max-h-60 overflow-y-auto py-1 divide-y divide-transparent focus:outline-none"
            >
              {filteredOptions.length === 0 ? (
                <motion.li
                  variants={isTest ? undefined : itemVariants}
                  className="px-3.5 py-3 text-xs text-zinc-400 text-center italic"
                >
                  Không tìm thấy tùy chọn phù hợp
                </motion.li>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <motion.li
                      key={String(opt.value)}
                      variants={isTest ? undefined : itemVariants}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                      className={`relative flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed bg-gray-50'
                          : isSelected
                          ? 'bg-[#78C841]/15 text-[#1A1A1A] font-bold'
                          : isHighlighted
                          ? 'bg-slate-100/80 text-slate-900 font-semibold'
                          : 'text-slate-800 font-semibold hover:bg-slate-50'
                      }`}
                    >
                      {renderOption ? (
                        renderOption(opt, isSelected)
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {opt.color && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10 shadow-2xs"
                                style={{ backgroundColor: opt.color }}
                              />
                            )}
                            {opt.icon && (
                              <span className="shrink-0 text-zinc-500">{opt.icon}</span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-semibold">{opt.label}</span>
                                {opt.badge && (
                                  <span
                                    className={`shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                      isSelected
                                        ? 'bg-white/90 text-zinc-800 border-zinc-200'
                                        : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                    }`}
                                  >
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              {opt.description && (
                                <p className={`text-[10px] font-medium truncate mt-0.5 ${
                                  isSelected ? 'text-zinc-700' : 'text-slate-500'
                                }`}>
                                  {opt.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <motion.span
                              initial={isTest ? undefined : { scale: 0, opacity: 0 }}
                              animate={isTest ? undefined : { scale: 1, opacity: 1 }}
                              exit={isTest ? undefined : { scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="shrink-0 flex items-center justify-center text-zinc-900 ml-1"
                            >
                              <Check
                                className="w-3.5 h-3.5 stroke-[2.5]"
                                aria-hidden="true"
                              />
                            </motion.span>
                          )}
                        </>
                      )}
                    </motion.li>
                  );
                })
              )}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

export default Select;
