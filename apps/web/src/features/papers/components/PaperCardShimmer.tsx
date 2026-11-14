'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';

interface PaperCardShimmerProps {
  cardCount?: number;
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

const cardVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
};

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
  backgroundSize: '200% 100%',
};

export const PaperCardShimmer: React.FC<PaperCardShimmerProps> = ({
  cardCount = 8,
}) => {
  return (
    <>
      {Array.from({ length: cardCount }, (_, index) => (
        <motion.div
          key={`paper-card-shimmer-${index}`}
          variants={isTest ? undefined : cardVariants}
          initial={isTest ? undefined : "initial"}
          animate={isTest ? undefined : "animate"}
          transition={isTest ? { duration: 0 } : {
            delay: index * 0.04,
            duration: 0.35,
          }}
          className="w-full bg-gray-200/50 p-4 rounded-3xl flex flex-col justify-between relative overflow-hidden select-none min-h-[178px]"
        >
          <div>
            {/* Top row: Journal badge & Status badge */}
            <div className="flex items-center justify-between mb-2.5">
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-5 w-14 rounded-full"
              />
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-5 w-16 rounded-full"
              />
            </div>

            {/* Title skeletons (2 lines) */}
            <div className="space-y-1.5 mb-2.5">
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-3.5 w-4/5 rounded-md"
              />
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-3.5 w-3/5 rounded-md"
              />
            </div>

            {/* Authors skeleton */}
            <motion.div
              variants={isTest ? undefined : shimmerVariants}
              initial={isTest ? undefined : "initial"}
              animate={isTest ? undefined : "animate"}
              style={shimmerStyle}
              className="h-3 w-1/2 rounded-md mb-2"
            />

            {/* Meta stats row */}
            <motion.div
              variants={isTest ? undefined : shimmerVariants}
              initial={isTest ? undefined : "initial"}
              animate={isTest ? undefined : "animate"}
              style={shimmerStyle}
              className="h-2.5 w-1/3 rounded-md mb-2"
            />
          </div>

          {/* Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-gray-300/40 flex items-center justify-between">
            <motion.div
              variants={isTest ? undefined : shimmerVariants}
              initial={isTest ? undefined : "initial"}
              animate={isTest ? undefined : "animate"}
              style={shimmerStyle}
              className="h-3 w-20 rounded-md"
            />
            <motion.div
              variants={isTest ? undefined : shimmerVariants}
              initial={isTest ? undefined : "initial"}
              animate={isTest ? undefined : "animate"}
              style={shimmerStyle}
              className="h-3.5 w-3.5 rounded-full"
            />
          </div>
        </motion.div>
      ))}
    </>
  );
};

export default PaperCardShimmer;
