'use client';

import React from 'react';
import { motion, MotionConfig } from 'framer-motion';

/** Real app screenshots (names, titles and contact details are pixelated in the files). */
const SHOTS = [
  { src: '/auth-preview/editor.jpg', label: 'Trình soạn thảo', ratio: '1100 / 542', left: 3, top: 3, width: 64, rotate: -4, z: 1 },
  { src: '/auth-preview/papers.jpg', label: 'Danh sách bài báo', ratio: '1100 / 540', left: 40, top: 20, width: 57, rotate: 3, z: 2 },
  { src: '/auth-preview/validate.jpg', label: 'Kiểm định chuẩn', ratio: '1100 / 995', left: 5, top: 38, width: 33, rotate: 4, z: 3 },
  { src: '/auth-preview/templates.jpg', label: 'Mẫu & tạp chí', ratio: '1100 / 540', left: 36, top: 49, width: 56, rotate: -3, z: 4 },
  { src: '/auth-preview/history.jpg', label: 'Lịch sử phiên bản', ratio: '1100 / 544', left: 22, top: 70, width: 58, rotate: 2, z: 5 },
];

function ShotFrame({ shot, index }: { shot: (typeof SHOTS)[number]; index: number }) {
  return (
    <motion.figure
      className="absolute m-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
      style={{
        left: `${shot.left}%`,
        top: `${shot.top}%`,
        width: `${shot.width}%`,
        zIndex: shot.z,
      }}
      initial={{ opacity: 0, y: 48, rotate: shot.rotate + (index % 2 ? 6 : -6), scale: 0.94 }}
      animate={{ opacity: 1, y: 0, rotate: shot.rotate, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.15 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.05, rotate: 0, zIndex: 20, transition: { duration: 0.25 } }}
    >
      <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-zinc-300" />
        <span className="h-2 w-2 rounded-full bg-zinc-300" />
        <span className="h-2 w-2 rounded-full bg-[#78C841]" />
        <span className="ml-2 truncate text-[10px] font-semibold text-zinc-500">{shot.label}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shot.src}
        alt={`Giao diện ${shot.label.toLowerCase()} của StructPaper`}
        loading="lazy"
        draggable={false}
        className="block w-full select-none"
        style={{ aspectRatio: shot.ratio }}
      />
    </motion.figure>
  );
}

/**
 * Shared frame of the unauthenticated pages: a rounded split screen. The left side holds the
 * page (form); the right side (hidden below lg) previews the app with overlapping screenshots.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="w-full flex-1 bg-[#F1F3F5] p-0 selection:bg-[#78C841] selection:text-black lg:p-4">
        <div className="relative mx-auto flex min-h-full w-full max-w-[1440px] overflow-hidden bg-[#F8F9FA] shadow-[0_20px_60px_rgba(15,23,42,0.10)] lg:min-h-[calc(100vh-var(--titlebar-height,0px)-2rem)] lg:rounded-[32px]">
          <p className="pointer-events-none absolute left-5 top-3 z-10 max-w-[60%] text-[11px] font-medium text-zinc-400 lg:left-9 lg:top-7">
            Hệ thống Quản lý &amp; Xuất bản Bản thảo Chuẩn ĐHQG-HCM
          </p>
          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full flex-col px-6 py-8 sm:px-12 lg:w-1/2 lg:px-16"
          >
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">{children}</div>
          </motion.main>

          <aside
            aria-hidden="true"
            className="relative hidden overflow-hidden bg-[#ECEFF2] lg:block lg:w-1/2 lg:m-3 lg:rounded-[24px]"
          >
            <div className="absolute inset-x-6 bottom-6 top-8 xl:inset-x-10">
              {SHOTS.map((shot, i) => (
                <ShotFrame key={shot.src} shot={shot} index={i} />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </MotionConfig>
  );
}
