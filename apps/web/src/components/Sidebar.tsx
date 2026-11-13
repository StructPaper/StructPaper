'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  FolderArchive,
  User,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    path: '/papers',
    label: 'Quản lý Bài báo',
    description: 'Quản lý & lưu trữ bản thảo',
    icon: FolderArchive,
  },
  {
    path: '/upload',
    label: 'Tải file DOCX',
    description: 'Nhập & bóc tách bản thảo',
    icon: FileText,
  },
  {
    path: '/templates',
    label: 'Quản lý Mẫu & Tạp chí',
    description: '7 Tạp chí ĐHQG & Quy định',
    icon: BookOpen,
  },
  {
    path: '/permissions',
    label: 'Phân quyền & Vai trò',
    description: 'Quản lý vai trò & thành viên',
    icon: ShieldCheck,
  },
  {
    path: '/settings',
    label: 'Cài đặt',
    description: 'Quy chuẩn & xuất bản',
    icon: Settings,
  },
];

interface DockPillButtonProps {
  id?: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  isExpanded: boolean;
  tooltipText?: string;
}

const DockPillButton: React.FC<DockPillButtonProps> = ({
  id,
  icon,
  label,
  description,
  onClick,
  href,
  active,
  disabled,
  isExpanded,
  tooltipText,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (isExpanded) return;
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 250);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const buttonInner = (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-center ${showTooltip ? 'z-[100]' : ''}`}
    >
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center transition-[width,height,background-color,box-shadow,border-color,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] select-none cursor-pointer relative overflow-hidden group 
          ${isExpanded ? 'pl-2 rounded-[30px] w-[280px] h-[70px] justify-start' : 'rounded-full w-[58px] h-[58px] justify-center p-0'
          } ${active
            ? 'bg-[#78C841] border-4 border-lime-200 shadow-[0_0_18px_rgba(120,200,65,0.40),0_0_4px_rgba(120,200,65,0.25)] scale-[1.01]'
            : 'bg-white/80 hover:bg-white backdrop-blur-md shadow-[0_0_14px_rgba(0,0,0,0.08),0_0_3px_rgba(0,0,0,0.04)] hover:shadow-[0_0_22px_rgba(0,0,0,0.12),0_0_5px_rgba(0,0,0,0.06)] text-zinc-700 hover:text-zinc-950 border border-white/80 hover:scale-[1.02] active:scale-[0.98]'
          } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        aria-label={label}
      >
        {/* Fixed Icon slot: fills the button perfectly in collapsed mode to center 100%, and fixed width when expanded */}
        <div
          className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isExpanded ? 'w-[52px] h-full' : 'w-full h-full'
            }`}
        >
          {icon}
        </div>

        {/* Animated Text slot: 0 width and 0 padding when collapsed to never shift the icon */}
        <div
          className={`flex flex-col justify-center text-left whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded
            ? 'flex-1 min-w-0 pr-4 pl-1 opacity-100 max-w-[210px]'
            : 'w-0 max-w-0 p-0 m-0 opacity-0 overflow-hidden pointer-events-none'
            }`}
        >
          <span
            className={`font-extrabold text-[13px] leading-tight block truncate ${active ? 'text-zinc-950' : 'text-zinc-800 group-hover:text-zinc-950'
              }`}
          >
            {label}
          </span>
          {description && (
            <span
              className={`text-[11px] font-semibold leading-tight block truncate mt-0.5 ${active ? 'text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-500'
                }`}
            >
              {description}
            </span>
          )}
        </div>
      </button>

      {/* Liquid Glass Tooltip matching EditorLeftDock */}
      <AnimatePresence>
        {showTooltip && !isExpanded && !active && tooltipText && (
          <div className="absolute left-[64px] top-1/2 -translate-y-1/2 z-[100] pointer-events-none whitespace-nowrap">
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-10 px-3.5 rounded-3xl flex items-center bg-white/90 backdrop-blur-md border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_6px_rgba(0,0,0,0.04)] text-zinc-800 font-extrabold text-xs tracking-tight drop-shadow-xl whitespace-nowrap"
            >
              {tooltipText}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="outline-none block" tabIndex={-1}>
        {buttonInner}
      </Link>
    );
  }

  return buttonInner;
};

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isNavActive = (path: string) => {
    if (path === '/upload' && (pathname === '/' || pathname === '/upload')) return true;
    if (path === '/papers' && (pathname.startsWith('/papers') || pathname === '/history')) return true;
    if (path === '/templates' && pathname.startsWith('/templates')) return true;
    if (path === '/account' && pathname.startsWith('/account')) return true;
    if (path === '/settings' && pathname.startsWith('/settings')) return true;
    return pathname === path;
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      const confirmLogout = window.confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?');
      if (confirmLogout) {
        alert('Đã đăng xuất thành công.');
      }
    }
  };

  return (
    <>
      {/* DESKTOP & TABLET DOCK - NO WRAPPER BOX, EXPANDING PILLS WITH CHEVRON TOGGLE */}
      <aside
        className={`hidden sm:flex flex-col items-start justify-between h-[calc(100vh-var(--titlebar-height,0px)-1.5rem)] sticky top-[calc(var(--titlebar-height,0px)+0.75rem)] my-3 ml-3.5 flex-shrink-0 z-50 select-none transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'w-[280px]' : 'w-[58px]'
          }`}
        aria-label="Thanh điều hướng chính"
      >
        {/* TOP SECTION: TOGGLE EXPAND / COLLAPSE BUTTON WITH CHEVRON */}
        <div className="relative flex flex-col items-start gap-3 w-full">
          <DockPillButton
            onClick={() => setIsExpanded(!isExpanded)}
            isExpanded={isExpanded}
            icon={
              isExpanded ? (
                <ChevronLeft
                  className="w-5 h-5 text-zinc-700 transition-transform group-hover:-translate-x-0.5"
                  strokeWidth={2.8}
                />
              ) : (
                <ChevronRight
                  className="w-5 h-5 text-zinc-700 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.8}
                />
              )
            }
            label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            description={isExpanded ? 'Chuyển về xem gọn icon' : 'Xem chi tiết tên & mô tả'}
            tooltipText={isExpanded ? undefined : 'Mở rộng thanh điều hướng'}
          />
        </div>

        {/* MIDDLE SECTION: MAIN FLOW NAVIGATION PILLS */}
        <div className={`relative flex flex-col items-start w-full transition-all duration-300 ${isExpanded ? 'space-y-1' : 'space-y-3'}`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.path);

            return (
              <DockPillButton
                key={item.path}
                href={item.path}
                isExpanded={isExpanded}
                active={active}
                icon={
                  <Icon
                    className={`w-5 h-5 transition-colors ${active ? 'text-zinc-950' : 'text-zinc-700 group-hover:text-zinc-950'
                      }`}
                    strokeWidth={2.8}
                  />
                }
                label={item.label}
                description={item.description}
                tooltipText={isExpanded ? undefined : item.label}
              />
            );
          })}
        </div>

        {/* BOTTOM SECTION: LOGOUT BUTTON */}
        <div className="relative flex flex-col items-start gap-3 w-full">
          <DockPillButton
            onClick={handleLogout}
            isExpanded={isExpanded}
            icon={
              <LogOut
                className="w-4 h-4 text-zinc-600 group-hover:text-rose-600 transition-colors"
                strokeWidth={2.8}
              />
            }
            label="Đăng xuất"
            description="Rời khỏi hệ thống"
            tooltipText={isExpanded ? undefined : 'Đăng xuất tài khoản'}
          />
        </div>
      </aside>

      {/* MOBILE TOP NAVIGATION BAR */}
      <div className="sm:hidden sticky top-[var(--titlebar-height,0px)] z-40 bg-white/85 backdrop-blur-md border-b border-gray-100/80 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-zinc-900 cursor-pointer"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="font-extrabold text-sm text-[#1A1A1A] leading-tight">
              TS. Nguyễn Hoàng Nam
            </h1>
            <p className="text-[10px] text-zinc-400">ĐHQG TP.HCM</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE SLIDE-OVER DRAWER BACKDROP */}
      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-72 h-full max-w-[85vw] bg-white/95 backdrop-blur-xl border-r border-zinc-200 flex flex-col rounded-r-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-zinc-900 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                  HN
                </div>
                <div>
                  <span className="font-extrabold text-sm text-zinc-900 block leading-tight">
                    TS. Nguyễn Hoàng Nam
                  </span>
                  <span className="text-[10px] text-zinc-400">nam.nh@vnuhcm.edu.vn</span>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all ${active
                      ? 'bg-[#78C841] text-zinc-950 font-bold shadow-md shadow-[#78C841]/20 border-2 border-lime-200'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                      }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${active ? 'text-zinc-950' : 'text-zinc-700'}`}
                      strokeWidth={2.8}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-bold block ${active ? 'text-zinc-950' : ''}`}>
                        {item.label}
                      </span>
                      <p
                        className={`text-[10.5px] truncate mt-0.5 ${
                          active ? 'text-zinc-800 font-medium' : 'text-zinc-400'
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="p-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" strokeWidth={2.8} />
                <span>Đăng xuất tài khoản</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
