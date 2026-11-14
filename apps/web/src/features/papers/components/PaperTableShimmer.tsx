'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';

interface PaperTableShimmerProps {
  rowCount?: number;
}

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

const rowVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
};

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
  backgroundSize: '200% 100%',
};

export const PaperTableShimmer: React.FC<PaperTableShimmerProps> = ({
  rowCount = 8,
}) => {
  return (
    <div
      data-testid="papers-table-shimmer"
      className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden select-none"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 bg-gray-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center">Ghim</th>
              <th className="py-3 px-4 min-w-[260px]">Tên bài báo & Mã bài</th>
              <th className="py-3 px-4 min-w-[130px]">Tạp chí</th>
              <th className="py-3 px-4 min-w-[120px]">Trạng thái</th>
              <th className="py-3 px-4 min-w-[180px]">Tác giả</th>
              <th className="py-3 px-4 min-w-[120px]">Cập nhật</th>
              <th className="py-3 px-3 w-28 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {Array.from({ length: rowCount }, (_, index) => (
              <motion.tr
                key={`paper-table-shimmer-row-${index}`}
                variants={isTest ? undefined : rowVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                transition={isTest ? { duration: 0 } : {
                  delay: index * 0.03,
                  duration: 0.35,
                }}
                className="hover:bg-slate-50/50 transition-colors"
              >
                {/* 1. Pin cell */}
                <td className="py-3 px-3 text-center">
                  <motion.div
                    variants={isTest ? undefined : shimmerVariants}
                    initial={isTest ? undefined : "initial"}
                    animate={isTest ? undefined : "animate"}
                    style={shimmerStyle}
                    className="w-5 h-5 rounded-md mx-auto"
                  />
                </td>

                {/* 2. Title & ID cell */}
                <td className="py-3 px-4 min-w-[260px]">
                  <div className="space-y-1.5">
                    <motion.div
                      variants={isTest ? undefined : shimmerVariants}
                      initial={isTest ? undefined : "initial"}
                      animate={isTest ? undefined : "animate"}
                      style={shimmerStyle}
                      className={`h-3.5 rounded-md ${
                        index % 3 === 0 ? 'w-4/5' : index % 3 === 1 ? 'w-3/4' : 'w-5/6'
                      }`}
                    />
                    <motion.div
                      variants={isTest ? undefined : shimmerVariants}
                      initial={isTest ? undefined : "initial"}
                      animate={isTest ? undefined : "animate"}
                      style={shimmerStyle}
                      className="h-2.5 w-24 rounded-md"
                    />
                  </div>
                </td>

                {/* 3. Journal badge cell */}
                <td className="py-3 px-4 min-w-[130px]">
                  <motion.div
                    variants={isTest ? undefined : shimmerVariants}
                    initial={isTest ? undefined : "initial"}
                    animate={isTest ? undefined : "animate"}
                    style={shimmerStyle}
                    className="h-5 w-20 rounded-full"
                  />
                </td>

                {/* 4. Status badge cell */}
                <td className="py-3 px-4 min-w-[120px]">
                  <motion.div
                    variants={isTest ? undefined : shimmerVariants}
                    initial={isTest ? undefined : "initial"}
                    animate={isTest ? undefined : "animate"}
                    style={shimmerStyle}
                    className="h-5 w-24 rounded-full"
                  />
                </td>

                {/* 5. Authors cell */}
                <td className="py-3 px-4 min-w-[180px]">
                  <motion.div
                    variants={isTest ? undefined : shimmerVariants}
                    initial={isTest ? undefined : "initial"}
                    animate={isTest ? undefined : "animate"}
                    style={shimmerStyle}
                    className={`h-3 rounded-md ${
                      index % 2 === 0 ? 'w-36' : 'w-28'
                    }`}
                  />
                </td>

                {/* 6. Updated time cell */}
                <td className="py-3 px-4 min-w-[120px]">
                  <motion.div
                    variants={isTest ? undefined : shimmerVariants}
                    initial={isTest ? undefined : "initial"}
                    animate={isTest ? undefined : "animate"}
                    style={shimmerStyle}
                    className="h-3 w-20 rounded-md"
                  />
                </td>

                {/* 7. Action buttons cell */}
                <td className="py-3 px-3 w-28 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <motion.div
                      variants={isTest ? undefined : shimmerVariants}
                      initial={isTest ? undefined : "initial"}
                      animate={isTest ? undefined : "animate"}
                      style={shimmerStyle}
                      className="h-7 w-7 rounded-lg"
                    />
                    <motion.div
                      variants={isTest ? undefined : shimmerVariants}
                      initial={isTest ? undefined : "initial"}
                      animate={isTest ? undefined : "animate"}
                      style={shimmerStyle}
                      className="h-7 w-7 rounded-lg"
                    />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
