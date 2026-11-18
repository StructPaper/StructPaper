'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuthorsTabProps } from './types';
import { UserCheck, Building, Plus } from 'lucide-react';
import { useTabScrollRestoration } from '../hooks';
import { SelectOption } from '@/components/ui/Select';
import { normalizeAffiliations } from '@/types/paper';
import { AuthorItemCard } from './AuthorItemCard';
import { AffiliationItemCard } from './AffiliationItemCard';
import {
  useEditorCommandBus,
  dispatchAddAuthor,
  dispatchUpdateAuthor,
  dispatchRemoveAuthor,
  dispatchAddAffiliation,
  dispatchUpdateAffiliation,
  dispatchRemoveAffiliation,
  dispatchMetadataField,
} from './command-bus-adapter';

export const AuthorsTab: React.FC<AuthorsTabProps> = ({
  metadata,
  onChange,
  commandBus: propCommandBus,
}) => {
  const contextCommandBus = useEditorCommandBus().commandBus;
  const activeBus = propCommandBus || contextCommandBus;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useTabScrollRestoration('authors', scrollContainerRef);

  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [deletingAuthorIds, setDeletingAuthorIds] = useState<Set<string>>(new Set());
  const [deletingAffiliationIds, setDeletingAffiliationIds] = useState<Set<string>>(new Set());

  // Auto-normalize affiliations so that duplicate IDs (e.g. Vietnamese & English entries)
  // are permanently merged into single bilingual cards
  useEffect(() => {
    const rawAffs = metadata.affiliations || [];
    const norm = normalizeAffiliations(rawAffs);
    if (norm.length !== rawAffs.length) {
      dispatchMetadataField(activeBus, 'affiliations', norm, onChange, metadata);
    }
  }, [metadata.affiliations, activeBus, onChange, metadata]);

  // Options for the custom Select component
  const affOptions: SelectOption[] = useMemo(() => {
    return (metadata.affiliations || []).map((aff) => ({
      value: String(aff.id),
      label: `[${aff.id}] ${aff.name || `Cơ quan ${aff.id}`}`,
      description: aff.nameEn ? aff.nameEn : undefined,
    }));
  }, [metadata.affiliations]);

  // Smooth scroll and auto-focus newly added author or affiliation
  useEffect(() => {
    if (!newlyAddedId) return;

    const timer = setTimeout(() => {
      const el =
        document.getElementById(`author-item-${newlyAddedId}`) ||
        document.getElementById(`aff-item-${newlyAddedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const inputEl = el.querySelector<HTMLInputElement>(
          'input[type="text"], input[type="email"]'
        );
        if (inputEl) {
          inputEl.focus();
        }
      }
    }, 100);

    const clearTimer = setTimeout(() => {
      setNewlyAddedId(null);
    }, 1800);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [newlyAddedId]);

  const handleAddAuthor = () => {
    const newId = `a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const defaultAffId = metadata.affiliations.length > 0 ? metadata.affiliations[0].id : 1;
    const newAuthor = {
      id: newId,
      name: '',
      affiliationIds: metadata.affiliations.length > 0 ? [defaultAffId] : [1],
      isCorresponding: false,
      email: '',
      orcid: '',
    };
    dispatchAddAuthor(activeBus, newAuthor, onChange, metadata);
    setNewlyAddedId(newId);
  };

  const handleRemoveAuthor = (index: number) => {
    const author = metadata.authors[index];
    const authorId = author.id || `a_${index}`;
    if (deletingAuthorIds.has(authorId)) return;

    setDeletingAuthorIds((prev) => new Set(prev).add(authorId));

    setTimeout(() => {
      dispatchRemoveAuthor(activeBus, authorId, onChange, metadata);
      setDeletingAuthorIds((prev) => {
        const next = new Set(prev);
        next.delete(authorId);
        return next;
      });
    }, 320);
  };

  const handleAddAffiliation = () => {
    const nextId = (metadata.affiliations.length || 0) + 1;
    const newAff = { id: nextId, name: '', nameEn: '' };
    dispatchAddAffiliation(activeBus, newAff, onChange, metadata);
    setNewlyAddedId(`aff_${nextId}`);
  };

  const handleRemoveAffiliation = (index: number) => {
    const aff = metadata.affiliations[index];
    const affKey = `aff_${aff.id}`;
    if (deletingAffiliationIds.has(affKey)) return;

    setDeletingAffiliationIds((prev) => new Set(prev).add(affKey));

    setTimeout(() => {
      dispatchRemoveAffiliation(activeBus, aff.id, onChange, metadata);
      setDeletingAffiliationIds((prev) => {
        const next = new Set(prev);
        next.delete(affKey);
        return next;
      });
    }, 320);
  };

  return (
    <div ref={scrollContainerRef} className="h-full flex flex-col min-h-0 space-y-6 overflow-y-auto p-4 sm:p-5 sm:pb-6">
      {/* Authors Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Danh sách Tác giả ({metadata.authors.length})
            </h3>
          </div>
          <button data-edit-only
            type="button"
            onClick={handleAddAuthor}
            className="btn-pill-lime text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm tác giả</span>
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Nhập họ tên, chọn cơ quan công tác tương ứng và đánh dấu tác giả liên hệ để hiển thị đúng dấu sao (*) trong bài báo.
        </p>

        <div className="space-y-1.5 scroll-smooth">
          {metadata.authors.map((author, idx) => {
            const authorId = author.id || `a_${idx}`;
            return (
              <AuthorItemCard
                key={authorId}
                author={author}
                idx={idx}
                totalAuthors={metadata.authors.length}
                affiliations={metadata.affiliations}
                affOptions={affOptions}
                isDeleting={deletingAuthorIds.has(authorId)}
                isNewlyAdded={authorId === newlyAddedId}
                onUpdateAuthor={(updatedAuthor) => {
                  dispatchUpdateAuthor(activeBus, authorId, updatedAuthor, onChange, metadata);
                }}
                onRemoveAuthor={() => handleRemoveAuthor(idx)}
              />
            );
          })}
        </div>
      </div>

      {/* Affiliations Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/80">
          <div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-zinc-700" />
              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
                Cơ quan & Viện nghiên cứu ({metadata.affiliations.length})
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Mỗi cơ quan có cùng mã số ID, gồm tên Tiếng Việt & Tiếng Anh.
            </p>
          </div>
          <button data-edit-only
            type="button"
            onClick={handleAddAffiliation}
            className="btn-pill-subtle text-xs py-1.5 px-3 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm cơ quan</span>
          </button>
        </div>

        <div className="space-y-2.5 scroll-smooth">
          {metadata.affiliations.map((aff, idx) => {
            const affKey = `aff_${aff.id}`;
            const authorUsageCount = metadata.authors.filter((a) =>
              (a.affiliationIds || []).includes(aff.id)
            ).length;

            return (
              <AffiliationItemCard
                key={aff.id || idx}
                aff={aff}
                idx={idx}
                authorUsageCount={authorUsageCount}
                isDeleting={deletingAffiliationIds.has(affKey)}
                isNewlyAdded={affKey === newlyAddedId}
                onUpdateAff={(updatedAff) => {
                  dispatchUpdateAffiliation(activeBus, aff.id, updatedAff, onChange, metadata);
                }}
                onRemoveAff={() => handleRemoveAffiliation(idx)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
