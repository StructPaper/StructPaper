'use client';

import React from 'react';
import { Author, Affiliation } from '@/types/paper';
import { Trash2, AlertCircle } from 'lucide-react';
import { Select, SelectOption } from '@/components/ui/Select';

interface AuthorItemCardProps {
  author: Author;
  idx: number;
  totalAuthors: number;
  affiliations: Affiliation[];
  affOptions: SelectOption[];
  isDeleting: boolean;
  isNewlyAdded: boolean;
  onUpdateAuthor: (updated: Author) => void;
  onRemoveAuthor: () => void;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const AuthorItemCard: React.FC<AuthorItemCardProps> = ({
  author,
  idx,
  totalAuthors,
  affiliations,
  affOptions,
  isDeleting,
  isNewlyAdded,
  onUpdateAuthor,
  onRemoveAuthor,
}) => {
  const authorId = author.id || `a_${idx}`;
  const isEmailEntered = Boolean(author.email && author.email.trim());
  const isEmailInvalid = isEmailEntered && !isValidEmail(author.email!);
  const isCorrMissingValidEmail = Boolean(
    author.isCorresponding && (!author.email || !isValidEmail(author.email))
  );

  const selectedAffVal = String(
    author.affiliationIds?.[0] ||
    (affiliations.length > 0 ? affiliations[0].id : '1')
  );

  return (
    <div
      id={`author-item-${authorId}`}
      style={{ zIndex: totalAuthors - idx }}
      className={`grid transition-all duration-300 ease-in-out relative focus-within:z-40 ${
        isDeleting
          ? 'grid-rows-[0fr] opacity-0 scale-95 -translate-y-2 pointer-events-none'
          : 'grid-rows-[1fr] opacity-100 scale-100 translate-y-0'
      } ${isNewlyAdded ? 'animate-section-enter' : ''}`}
    >
      <div>
        <div
          className={`p-4 rounded-3xl bg-gray-200/50 flex flex-col gap-3 transition-all duration-300 ${
            isNewlyAdded ? 'section-highlight-glow ring-2 ring-blue-300' : ''
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            {/* 1. Author Name (col-span-4) */}
            <div className="md:col-span-4">
              <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                Họ và tên tác giả:
              </label>
              <input
                type="text"
                value={author.name}
                placeholder="Nguyễn Văn A"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => {
                  onUpdateAuthor({ ...author, name: e.target.value });
                }}
                className="w-full p-2.5 rounded-xl text-xs font-bold text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
              />
            </div>

            {/* 2. Affiliation Custom Select (col-span-4) */}
            <div className="md:col-span-4">
              <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                Cơ quan công tác:
              </label>
              {affOptions.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 italic">
                  Chưa có cơ quan nào bên dưới. Vui lòng thêm cơ quan trước.
                </div>
              ) : (
                <Select
                  value={selectedAffVal}
                  onChange={(val) => {
                    const pickedId = parseInt(val, 10);
                    if (isNaN(pickedId)) return;
                    onUpdateAuthor({
                      ...author,
                      affiliationIds: [pickedId],
                    });
                  }}
                  options={affOptions}
                  size="sm"
                  placeholder="Chọn cơ quan công tác..."
                  fullWidth
                />
              )}
            </div>

            {/* 3. Email (col-span-4) */}
            <div className="md:col-span-4">
              <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                Email liên hệ:
              </label>
              <input
                type="email"
                value={author.email || ''}
                placeholder="author@vnuhcm.edu.vn"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => {
                  onUpdateAuthor({ ...author, email: e.target.value });
                }}
                className={`w-full p-2.5 rounded-xl text-xs text-zinc-900 bg-white focus:outline-none focus:ring-4 shadow-2xs transition-all ${
                  isEmailInvalid || isCorrMissingValidEmail
                    ? 'border border-red-400 bg-red-50/20 focus:ring-red-200 focus:border-red-400'
                    : 'focus:ring-blue-200 focus:border-blue-300'
                }`}
              />
              {isEmailInvalid && (
                <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" /> Email không đúng định dạng (vd: user@domain.com)
                </p>
              )}
              {!isEmailInvalid && isCorrMissingValidEmail && (
                <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" /> Tác giả liên hệ cần có email hợp lệ
                </p>
              )}
            </div>
          </div>

          {/* Row 2: ORCID */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6">
              <label className="text-[10px] font-bold text-zinc-600 block mb-1">
                Mã ORCID (tùy chọn):
              </label>
              <input
                type="text"
                value={author.orcid || ''}
                placeholder="0000-0002-1825-0097"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => {
                  onUpdateAuthor({ ...author, orcid: e.target.value });
                }}
                className="w-full p-2 rounded-xl text-xs font-mono text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
              />
            </div>
          </div>

          {/* Bottom Row: Corresponding Checkbox & Delete Author */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-300/40">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!author.isCorresponding}
                onChange={(e) => {
                  onUpdateAuthor({ ...author, isCorresponding: e.target.checked });
                }}
                className="rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer w-4 h-4"
              />
              <span className="font-bold text-zinc-800">Tác giả liên hệ* (Corresponding Author)</span>
            </label>

            <button data-edit-only
              type="button"
              disabled={isDeleting}
              onClick={onRemoveAuthor}
              className="px-2 py-1 rounded-xl text-zinc-500 hover:text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Xóa tác giả này"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
