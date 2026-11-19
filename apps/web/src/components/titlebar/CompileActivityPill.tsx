'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCompileActivity } from '@/features/papers/hooks/useCompileActivity';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

/**
 * Label in the middle of the title bar while papers are being imported or compiled. It reads the
 * compile queue on the server, so it is still there after a page reload and goes away when the
 * work is really finished.
 */
/** Only the list pages show it (papers, templates, permissions), not the editor. */
export const showsCompileActivity = (pathname?: string | null): boolean => /^\/(papers|templates|permissions)\/?$/.test(pathname ?? '');

export const CompileActivityPill: React.FC = () => {
  const pathname = usePathname();
  const { local, server, active: working } = useCompileActivity();
  const active = working && showsCompileActivity(pathname);
  const waiting = server.running + server.queued;

  const text = local
    ? `Đang nhập ${local.finished}/${local.total} bài báo`
    : server.running > 0
      ? `Đang biên dịch PDF · ${waiting} bài chưa xong`
      : `Đang chờ biên dịch PDF · ${waiting} bài`;
  const detail = local
    ? 'Đang nhập các bài báo vừa chọn'
    : `${server.running} bài đang biên dịch, ${server.queued} bài đang xếp hàng. Có thể mất vài phút.`;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="compile-activity"
          data-testid="titlebar-compile-activity"
          data-no-drag="true"
          role="status"
          aria-live="polite"
          title={detail}
          initial={isTest ? false : { opacity: 0, y: -6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={isTest ? undefined : { opacity: 0, y: -6, scale: 0.96 }}
          transition={isTest ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold select-none whitespace-nowrap"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.75} />
          <span>{text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
