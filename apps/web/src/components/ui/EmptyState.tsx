'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, type LucideIcon } from 'lucide-react';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  buttonText?: string;
  buttonIcon?: LucideIcon;
  onButtonClick?: () => void;
  className?: string;
  testId?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  buttonText,
  buttonIcon: ButtonIcon,
  onButtonClick,
  className = '',
  testId,
}) => {
  return (
    <motion.div
      data-testid={testId}
      initial={isTest ? false : { opacity: 0, y: 20 }}
      animate={isTest ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: isTest ? 0 : 0.3 }}
      className={`flex flex-col items-center justify-center text-center px-0 w-full ${className}`}
    >
      <div className="mb-6">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-[32px] md:rounded-[36px] bg-gray-50 flex items-center justify-center text-gray-300 border-2 border-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)] md:shadow-[inset_0_2px_10px_rgba(0,0,0,0.06)] mx-auto relative group">
          <Icon
            className="w-10 h-10 md:w-12 md:h-12 relative z-10 transition-transform duration-500 group-hover:scale-110 text-gray-400"
            strokeWidth={1.8}
          />
        </div>
      </div>

      <h3 className="text-base md:text-xl font-bold md:font-extrabold tracking-tight text-[#1A1A1A] mb-1 md:mb-1.5">
        {title}
      </h3>
      <p className="text-gray-400 text-xs md:text-sm font-medium leading-relaxed max-w-[260px] md:max-w-[340px]">
        {description}
      </p>

      {buttonText && (
        <div className="bg-[#E4F8D5] rounded-full p-1.5 mt-6 md:mt-8 mx-auto w-fit">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onButtonClick}
            className="group/btn relative h-[48px] md:h-[56px] bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 font-extrabold rounded-full flex items-center justify-center px-8 md:px-12 shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-300 overflow-hidden cursor-pointer"
          >
            <div className="flex items-center gap-2.5 md:gap-3 relative z-10 transition-all">
              {ButtonIcon && (
                <ButtonIcon
                  size={18}
                  className="md:size-5 group-hover/btn:rotate-12 transition-all duration-300"
                  strokeWidth={2.5}
                />
              )}
              <span className="text-sm md:text-base font-black tracking-tight uppercase">
                {buttonText}
              </span>
              <ChevronRight
                size={16}
                className="md:size-4 group-hover/btn:translate-x-1 transition-transform duration-300"
                strokeWidth={3}
              />
            </div>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

export default EmptyState;
