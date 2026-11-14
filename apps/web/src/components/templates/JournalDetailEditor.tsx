'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Save, Sliders, Eye, RotateCcw } from 'lucide-react';
import { JournalProfile } from '@structpaper/journal-profiles';
import {
  ManagedJournalProfile,
  JournalStatus,
} from '@/lib/templates/journal-storage';
import { toast } from '@/components/DynamicIslandToast';
import { useJournalEditorSave } from '@/hooks';
import { ActionConfirmModal } from '@/components/modals';
import { JournalEditorDock } from './JournalEditorDock';
import { JournalEditorTopBar } from './JournalEditorTopBar';
import {
  JournalEditorTabNav,
  JournalEditorTabKey,
} from './JournalEditorTabNav';
import { JournalGeneralTab } from './tabs/JournalGeneralTab';
import { JournalFrontMatterTab } from './tabs/JournalFrontMatterTab';
import { JournalArticleTypesTab } from './tabs/JournalArticleTypesTab';
import { JournalLayoutTab } from './tabs/JournalLayoutTab';
import { ResizableSplitLayout, LivePreviewPane, useEditorCompilation } from '@/features/editor';
import { generateSamplePaperForJournal } from '@/lib/templates/sample-template-paper';
import { CompletePaper } from '@/types/paper';

interface JournalDetailEditorProps {
  initialManaged: ManagedJournalProfile;
  isNew?: boolean;
}

function getPrecompiledPdfForJournal(id: string): string | null {
  const code = (id || '').toLowerCase();
  if (code === 'std' || code === 'vnuhcm-std') return '/sample-pdfs/STD.pdf';
  if (code === 'hs' || code === 'vnuhcm-hs') return '/sample-pdfs/HS.pdf';
  if (code === 'arns' || code === 'vnuhcm-arns') return '/sample-pdfs/ARNS.pdf';
  if (code === 'ebl' || code === 'vnuhcm-ebl') return '/sample-pdfs/EBL.pdf';
  if (code === 'ees' || code === 'vnuhcm-ees') return '/sample-pdfs/EES.pdf';
  if (code === 'et' || code === 'vnuhcm-et') return '/sample-pdfs/ET.pdf';
  if (code === 'ssh' || code === 'vnuhcm-ssh') return '/sample-pdfs/SSH.pdf';
  return null;
}

export const JournalDetailEditor: React.FC<JournalDetailEditorProps> = ({
  initialManaged,
  isNew = false,
}) => {
  const router = useRouter();

  const [managed, setManaged] = useState<ManagedJournalProfile>(initialManaged);
  const [activeTab, setActiveTab] = useState<JournalEditorTabKey>('general');
  const [isDirty, setIsDirty] = useState(false);

  // Dynamic sample paper based on active in-memory profile
  const samplePaper = useMemo(
    () => generateSamplePaperForJournal(managed.profile),
    [managed.profile]
  );
  const [livePaper, setLivePaper] = useState<CompletePaper>(samplePaper);

  const {
    compiledPdfUrl,
    setCompiledPdfUrl,
    isCompilingPdf,
    compileStats,
    compileErrorInfo,
    setCompileErrorInfo,
    compileLatexToPdf,
  } = useEditorCompilation({
    paper: livePaper,
    formData: livePaper,
    onUpdatePaper: setLivePaper,
  });

  // Tách biệt logic quản lý lưu, xác nhận và khôi phục template sang custom hook
  const {
    isSaveWarningOpen,
    isResetWarningOpen,
    isSaving,
    saveSuccess,
    requestSave,
    confirmSave,
    cancelSave,
    requestReset,
    confirmReset,
    cancelReset,
  } = useJournalEditorSave({
    managed,
    setManaged,
    setIsDirty,
    isNew,
    onAfterReset: (reset) => {
      const resetSample = generateSamplePaperForJournal(reset.profile);
      setLivePaper(resetSample);
      compileLatexToPdf(resetSample);
    },
  });

  // Preload official precompiled PDF if available for instant display on mount
  useEffect(() => {
    const precompiled = getPrecompiledPdfForJournal(managed.id);
    if (precompiled && !compiledPdfUrl) {
      setCompiledPdfUrl(precompiled);
    }
  }, [managed.id, compiledPdfUrl, setCompiledPdfUrl]);

  const handleUpdateProfile = useCallback((patch: Partial<JournalProfile>) => {
    setManaged((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        ...patch,
      },
    }));
    setIsDirty(true);
  }, []);

  const handleToggleStatus = useCallback(() => {
    const nextStatus: JournalStatus =
      managed.status === 'published' ? 'draft' : 'published';
    setManaged((prev) => ({ ...prev, status: nextStatus }));
    setIsDirty(true);
    toast.info(
      'Trạng thái mẫu',
      nextStatus === 'published'
        ? 'Chuyển sang: Đang phát hành (published)'
        : 'Chuyển sang: Bản nháp (draft)'
    );
  }, [managed.status]);

  const handleRecompile = useCallback(async () => {
    const updated = generateSamplePaperForJournal(managed.profile);
    setLivePaper(updated);
    await compileLatexToPdf(updated);
  }, [managed.profile, compileLatexToPdf]);

  // Left Side: Editor Form Tabs with Header
  const leftEditorContent = (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden space-y-2.5">
      {/* Journal Header Bar: Title, Short code badge & English Subtitle */}
      <div className="flex-shrink-0">
        <JournalEditorTopBar
          profile={managed.profile}
          status={managed.status}
          isNew={isNew}
        />
      </div>

      {/* Tabs Navigation */}
      <div className="flex-shrink-0">
        <JournalEditorTabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          articleTypesCount={managed.profile.articleTypes?.length}
        />
      </div>

      <div className="flex-1 min-h-0 min-w-0 h-full w-full overflow-y-auto pr-1">
        {activeTab === 'general' && (
          <JournalGeneralTab
            profile={managed.profile}
            onChange={handleUpdateProfile}
            isNew={isNew}
          />
        )}
        {activeTab === 'frontmatter' && (
          <JournalFrontMatterTab
            profile={managed.profile}
            onChange={handleUpdateProfile}
          />
        )}
        {activeTab === 'article-types' && (
          <JournalArticleTypesTab
            profile={managed.profile}
            onChange={handleUpdateProfile}
          />
        )}
        {activeTab === 'layout' && (
          <JournalLayoutTab
            profile={managed.profile}
            onChange={handleUpdateProfile}
          />
        )}
      </div>
    </div>
  );

  // Right Side: Live XeLaTeX Preview
  const rightPreviewContent = (
    <div className="h-full flex flex-col min-h-0">
      <LivePreviewPane
        paper={livePaper}
        compiledPdfUrl={compiledPdfUrl}
        isCompilingPdf={isCompilingPdf}
        compileStats={compileStats}
        compileErrorInfo={compileErrorInfo}
        onRecompile={handleRecompile}
        onClearError={() => setCompileErrorInfo(null)}
      />
    </div>
  );

  return (
    <div className="h-full w-full flex flex-row p-2 sm:p-3 min-h-0 gap-2 sm:gap-3 overflow-hidden bg-[#F8F9FA]">
      {/* Dedicated Left Toolbar Dock */}
      <JournalEditorDock
        status={managed.status}
        onToggleStatus={handleToggleStatus}
        onReset={requestReset}
        onRecompile={handleRecompile}
        isCompiling={isCompilingPdf}
        onSave={requestSave}
        isSaving={isSaving}
        isDirty={isDirty}
        saveSuccess={saveSuccess}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 gap-2 sm:gap-3">
        {/* Mobile Header Toolbar (Only visible on phones) */}
        <div className="flex sm:hidden flex-shrink-0 items-center justify-between p-1.5 bg-white/80 backdrop-blur-md rounded-2xl border border-zinc-200">
          <button
            type="button"
            onClick={() => {
              if (router) router.push('/templates');
              else if (typeof window !== 'undefined') window.location.href = '/templates';
            }}
            aria-label="Quay lại danh mục tạp chí"
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 font-bold text-xs flex items-center gap-1 shadow-2xs"
            title="Quay lại danh mục tạp chí"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRecompile}
              disabled={isCompilingPdf}
              aria-label="Biên dịch lại xem thử (di động)"
              className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 shadow-2xs"
              title="Biên dịch lại xem thử"
            >
              <RefreshCw
                className={`w-4 h-4 ${isCompilingPdf ? 'animate-spin text-[#78C841]' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={requestSave}
              disabled={isSaving}
              aria-label="Lưu thay đổi (di động)"
              className="p-2 rounded-xl bg-[#78C841] text-zinc-950 font-bold shadow-2xs"
              title="Lưu thay đổi"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Split View: Left Forms & Right Live XeLaTeX Preview */}
        <div className="flex-1 min-h-0 h-full w-full overflow-hidden">
          <ResizableSplitLayout
            className="h-full"
            storageKey="structpaper_template_split_v2"
            leftContent={leftEditorContent}
            rightContent={rightPreviewContent}
            defaultSplit={50}
            minPercent={28}
            maxPercent={72}
          />
        </div>
      </div>

      {/* Warning Confirmation Modal when Saving Template */}
      <ActionConfirmModal
        isOpen={isSaveWarningOpen}
        onClose={cancelSave}
        onConfirm={confirmSave}
        variant="warning"
        title="Lưu cấu hình tạp chí?"
        previewCard={
          <div className="w-full bg-slate-50 border border-slate-200/70 rounded-3xl p-3.5 flex items-center gap-3 shadow-inner">
            <span
              className="shrink-0 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold text-white shadow-2xs"
              style={{ backgroundColor: managed.profile.color || '#000099' }}
            >
              {managed.profile.names?.short || managed.id.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 truncate">
                {managed.profile.names?.vi || managed.profile.names?.en || managed.id}
              </h4>
              <p className="text-[10.5px] text-zinc-500 font-medium truncate">
                Cập nhật cấu hình khuôn mẫu dàn trang & typography
              </p>
            </div>
          </div>
        }
        description="Thay đổi cấu hình template này sẽ cập nhật trực tiếp quy chuẩn dàn trang PDF, Word và các bài báo đang áp dụng mẫu tạp chí này. Bạn có chắc chắn muốn lưu các thay đổi?"
        cancelLabel="Hủy bỏ"
        confirmLabel="Xác nhận lưu"
        confirmIcon={<Save className="w-4 h-4" />}
        isLoading={isSaving}
        testId="template-save-confirm-modal"
        confirmTestId="confirm-save-template-btn"
      />

      {/* Reset Confirmation Modal */}
      <ActionConfirmModal
        isOpen={isResetWarningOpen}
        onClose={cancelReset}
        onConfirm={confirmReset}
        variant="danger"
        title="Khôi phục cấu hình gốc?"
        description="Toàn bộ tùy chỉnh của tạp chí này sẽ bị hoàn tác về thông số gốc mặc định của hệ thống. Bạn có chắc chắn muốn tiếp tục?"
        cancelLabel="Hủy bỏ"
        confirmLabel="Khôi phục gốc"
        confirmIcon={<RotateCcw className="w-4 h-4" />}
        testId="template-reset-confirm-modal"
        confirmTestId="confirm-reset-template-btn"
      />
    </div>
  );
};
