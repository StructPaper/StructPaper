import React from 'react';
import { BookOpen } from 'lucide-react';

/** Logo row shown at the top of every auth page. */
export function AuthBrand() {
  return (
    <div className="flex items-center justify-center gap-2.5 text-[#1A1A1A]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#78C841] text-[#1A1A1A]">
        <BookOpen className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-xl font-extrabold tracking-tight">StructPaper</span>
    </div>
  );
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-6 mt-8 text-center">
      <h1 className="font-serif text-4xl font-bold text-[#1A1A1A]">{title}</h1>
      {subtitle && <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-900/60">{subtitle}</p>}
    </div>
  );
}

/** White pill input with a leading icon; `trailing` is e.g. the show/hide-password button. */
export function AuthField({
  label,
  icon,
  trailing,
  labelAside,
  className = '',
  ...input
}: {
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  labelAside?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-2">
        <label className="text-xs font-semibold text-zinc-900/80">{label}</label>
        {labelAside}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-zinc-900/40">
          {icon}
        </span>
        <input
          {...input}
          className={`h-12 w-full rounded-full border border-[#1A1A1A]/10 bg-white pl-12 ${
            trailing ? 'pr-12' : 'pr-5'
          } text-sm font-medium text-zinc-900 transition placeholder:text-zinc-400 focus:border-[#78C841] focus:outline-none focus:ring-4 focus:ring-[#78C841]/25 ${className}`}
        />
        {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </div>
    </div>
  );
}

export const authPrimaryButton =
  'flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#1A1A1A] text-sm font-bold text-white transition hover:bg-[#78C841] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#1A1A1A]/20 disabled:text-zinc-900/40';

export const authLinkClass = 'font-semibold text-[#2F7D32] underline-offset-4 hover:underline';
