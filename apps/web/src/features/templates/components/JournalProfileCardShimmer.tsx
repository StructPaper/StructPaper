'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';

interface JournalProfileCardShimmerProps {
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

export const JournalProfileCardShimmer: React.FC<JournalProfileCardShimmerProps> = ({
  cardCount = 7,
}) => {
  return (
    <>
      {Array.from({ length: cardCount }, (_, index) => (
        <motion.div
          key={`journal-shimmer-${index}`}
          variants={isTest ? undefined : cardVariants}
          initial={isTest ? undefined : "initial"}
          animate={isTest ? undefined : "animate"}
          transition={isTest ? { duration: 0 } : {
            delay: index * 0.04,
            duration: 0.35,
          }}
          className="w-full bg-gray-200/40 border-8 border-gray-200 p-5 rounded-[38px] flex flex-col justify-between select-none relative overflow-hidden min-h-[252px]"
        >
          <div>
            {/* Top row badges */}
            <div className="flex items-center justify-between mb-2.5">
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-5 w-16 rounded-full"
              />
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-5 w-24 rounded-full"
              />
            </div>

            {/* Bilingual Journal Names matching 2-line Vi and 1-line En */}
            <div className="space-y-1.5 mb-2.5">
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-4 w-4/5 rounded-md"
              />
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-3.5 w-3/5 rounded-md"
              />
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-3 w-1/2 rounded-md italic"
              />
            </div>

            {/* Specification stats row matching wrapped 2 lines */}
            <div className="space-y-1.5 mb-2">
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-3 w-5/6 rounded-md"
              />
              <motion.div
                variants={isTest ? undefined : shimmerVariants}
                initial={isTest ? undefined : "initial"}
                animate={isTest ? undefined : "animate"}
                style={shimmerStyle}
                className="h-3 w-2/3 rounded-md"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-gray-300/50 flex items-center justify-between">
            <motion.div
              variants={isTest ? undefined : shimmerVariants}
              initial={isTest ? undefined : "initial"}
              animate={isTest ? undefined : "animate"}
              style={shimmerStyle}
              className="h-3.5 w-20 rounded-md"
            />
            <motion.div
              variants={isTest ? undefined : shimmerVariants}
              initial={isTest ? undefined : "initial"}
              animate={isTest ? undefined : "animate"}
              style={shimmerStyle}
              className="h-3.5 w-28 rounded-md"
            />
          </div>
        </motion.div>
      ))}
    </>
  );
};

export default JournalProfileCardShimmer;
