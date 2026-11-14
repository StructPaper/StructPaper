'use client';

import React, { useState } from 'react';
import { PaperAuthor, PaperAffiliation, PaperMetadata } from '@/types/paper';
import {
  Users,
  Building2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Star,
  Mail,
  GraduationCap,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface AuthorsTabProps {
  metadata: PaperMetadata;
  onChange: (updated: PaperMetadata) => void;
}

export const AuthorsTab: React.FC<AuthorsTabProps> = ({ metadata, onChange }) => {
  const authors = metadata.authors || [];
  const affiliations = metadata.affiliations || [];

  // Update Authors
  const updateAuthors = (newAuthors: PaperAuthor[]) => {
    // If corresponding author changed, update corresponding metadata
    const corr = newAuthors.find((a) => a.isCorresponding) || newAuthors[0];
    const corrAffil = corr
      ? affiliations.find((aff) => corr.affiliationIds?.includes(aff.id))?.name || ''
      : '';

    onChange({
      ...metadata,
      authors: newAuthors,
      corresponding: corr
        ? {
            name: corr.name,
            email: corr.email || '',
            affiliation: corrAffil,
          }
        : metadata.corresponding,
    });
  };

  // Add new author
  const handleAddAuthor = () => {
    const newAuthor: PaperAuthor = {
      id: `auth_${Date.now()}`,
      name: 'Tác giả mới',
      email: '',
      affiliationIds: affiliations.length > 0 ? [affiliations[0].id] : [1],
      isCorresponding: authors.length === 0,
      orcid: '',
    };
    updateAuthors([...authors, newAuthor]);
  };

  // Remove author
  const handleRemoveAuthor = (index: number) => {
    const next = [...authors];
    next.splice(index, 1);
    updateAuthors(next);
  };

  // Move author up/down
  const handleMoveAuthor = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= authors.length) return;
    const next = [...authors];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    updateAuthors(next);
  };

  // Toggle corresponding author
  const handleToggleCorresponding = (index: number) => {
    const next = authors.map((a, i) => ({
      ...a,
      isCorresponding: i === index,
    }));
    updateAuthors(next);
  };

  // Author field change
  const handleAuthorFieldChange = (index: number, field: keyof PaperAuthor, val: any) => {
    const next = [...authors];
    next[index] = { ...next[index], [field]: val };
    updateAuthors(next);
  };

  // Toggle affiliation ID for author
  const handleToggleAuthorAffil = (authorIndex: number, affilId: number) => {
    const target = authors[authorIndex];
    const currentIds = target.affiliationIds || [];
    let nextIds: number[];
    if (currentIds.includes(affilId)) {
      if (currentIds.length === 1) return; // keep at least one
      nextIds = currentIds.filter((id) => id !== affilId);
    } else {
      nextIds = [...currentIds, affilId];
    }
    handleAuthorFieldChange(authorIndex, 'affiliationIds', nextIds);
  };

  // Affiliations management
  const updateAffiliations = (newAffils: PaperAffiliation[]) => {
    onChange({
      ...metadata,
      affiliations: newAffils,
    });
  };

  const handleAddAffiliation = () => {
    const nextId =
      affiliations.length > 0
        ? Math.max(...affiliations.map((a) => a.id)) + 1
        : 1;
    const newAffil: PaperAffiliation = {
      id: nextId,
      name: 'Đơn vị công tác mới, Trường Đại học...',
    };
    updateAffiliations([...affiliations, newAffil]);
  };

  const handleAffiliationChange = (id: number, name: string) => {
    const next = affiliations.map((a) => (a.id === id ? { ...a, name } : a));
    updateAffiliations(next);
  };

  const handleRemoveAffiliation = (id: number) => {
    if (affiliations.length <= 1) return;
    const next = affiliations.filter((a) => a.id !== id);
    updateAffiliations(next);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Authors list card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#78C841]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Danh sách tác giả ({authors.length})
            </h3>
          </div>
          <button
            onClick={handleAddAuthor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#14532D] text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm tác giả
          </button>
        </div>

        <div className="space-y-4">
          {authors.map((author, idx) => (
            <div
              key={author.id || idx}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 relative group transition-all hover:border-slate-300"
            >
              {/* Header row: Author Index, Name, Actions */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={author.name}
                    onChange={(e) => handleAuthorFieldChange(idx, 'name', e.target.value)}
                    className="font-bold text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                    placeholder="Họ và tên tác giả"
                  />
                </div>

                <div className="flex items-center gap-1">
                  {/* Corresponding toggle */}
                  <button
                    onClick={() => handleToggleCorresponding(idx)}
                    title={author.isCorresponding ? 'Tác giả liên hệ chính' : 'Đặt làm tác giả liên hệ'}
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                      author.isCorresponding
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-white text-slate-400 hover:text-amber-600 border border-slate-200'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${author.isCorresponding ? 'fill-amber-500 text-amber-500' : ''}`} />
                    <span className="hidden sm:inline">Liên hệ</span>
                  </button>

                  {/* Reorder buttons */}
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveAuthor(idx, 'up')}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === authors.length - 1}
                    onClick={() => handleMoveAuthor(idx, 'down')}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  {authors.length > 1 && (
                    <button
                      onClick={() => handleRemoveAuthor(idx)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-row: Email & ORCID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={author.email || ''}
                    onChange={(e) => handleAuthorFieldChange(idx, 'email', e.target.value)}
                    className="w-full text-xs font-medium rounded-lg border border-slate-200 pl-8 pr-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                    placeholder="Email tác giả (vd: author@hcmut.edu.vn)"
                  />
                </div>
                <div className="relative">
                  <span className="text-[11px] font-bold text-emerald-600 absolute left-2.5 top-1/2 -translate-y-1/2">
                    ID
                  </span>
                  <input
                    type="text"
                    value={author.orcid || ''}
                    onChange={(e) => handleAuthorFieldChange(idx, 'orcid', e.target.value)}
                    className="w-full text-xs font-medium rounded-lg border border-slate-200 pl-8 pr-2.5 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                    placeholder="ORCID (0000-0002-xxxx-xxxx)"
                  />
                </div>
              </div>

              {/* Affiliations selection chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Đơn vị công tác của tác giả này:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {affiliations.map((aff) => {
                    const isSelected = author.affiliationIds?.includes(aff.id);
                    return (
                      <button
                        key={aff.id}
                        type="button"
                        onClick={() => handleToggleAuthorAffil(idx, aff.id)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#78C841]/15 text-[#14532D] border-[#78C841] font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        [{aff.id}] {aff.name.slice(0, 32)}...
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Affiliations management card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#78C841]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Đơn vị công tác ({affiliations.length})
            </h3>
          </div>
          <button
            onClick={handleAddAffiliation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-[#14532D] text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm cơ quan
          </button>
        </div>

        <div className="space-y-3">
          {affiliations.map((aff) => (
            <div key={aff.id} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-[#14532D] text-xs font-black flex items-center justify-center shrink-0">
                {aff.id}
              </span>
              <input
                type="text"
                value={aff.name}
                onChange={(e) => handleAffiliationChange(aff.id, e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 p-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                placeholder="Tên viện nghiên cứu, trường đại học, khoa bộ môn..."
              />
              {affiliations.length > 1 && (
                <button
                  onClick={() => handleRemoveAffiliation(aff.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
