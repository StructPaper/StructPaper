'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Save, RotateCcw, Eye, LogOut } from 'lucide-react';
import type { ProfileVersion } from '@structpaper/api-client';
import { JournalProfile } from '@structpaper/journal-profiles';
import {
  ManagedJournalProfile,
  JournalStatus,
} from '@/lib/templates/journal-storage';
import { toast } from '@/components/toast';
import { useJournalEditorSave } from '../hooks/useJournalEditorSave';
import {
  useJournalAccess,
  useProfileVersions,
  useJournalVersionProfile,
  describeChanges,
  JournalVersionsModal,
  JournalSaveDiffModal,
} from '@/features/journals';
import { useEditorSession } from '@/context/EditorSessionContext';
import { useUnsavedNavigationGuard } from '../hooks/useUnsavedNavigationGuard';
import { ActionConfirmModal } from '@/components/modals';
import { JournalEditorDock } from './JournalEditorDock';
import {
  JournalEditorTabNav,
  JournalEditorTabKey,
} from './JournalEditorTabNav';
import { JournalGeneralTab } from './tabs/JournalGeneralTab';
import { JournalFrontMatterTab } from './tabs/JournalFrontMatterTab';
import { JournalArticleTypesTab } from './tabs/JournalArticleTypesTab';
import { JournalLayoutTab } from './tabs/JournalLayoutTab';
import { JournalPublicationTab } from './tabs/JournalPublicationTab';
import { ResizableSplitLayout, LivePreviewPane, useEditorCompilation } from '@/features/editor';
import { generateSamplePaperForJournal } from '@/lib/templates/sample-template-paper';
import { CompletePaper } from '@/types/paper';

interface JournalDetailEditorProps {
  initialManaged: ManagedJournalProfile;
  isNew?: boolean;
  /** The journal's version on the server (its ETag): a save from a stale editor is refused. */
  serverVersion?: number;
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
  serverVersion,
}) => {
  const router = useRouter();
  // the API decides who may edit which journal; the screen only shows what it would allow
  const access = useJournalAccess(initialManaged.id, !isNew);
  const canEdit = isNew ? access.canCreate : access.canEdit;

  const [managed, setManaged] = useState<ManagedJournalProfile>(initialManaged);
  const [activeTab, setActiveTab] = useState<JournalEditorTabKey>('general');
  const [isDirty, setIsDirty] = useState(false);
  const { pdfLanguage, setJournalBar } = useEditorSession();
  const [historyOpen, setHistoryOpen] = useState(false);
  /** A past version shown read-only; null = the version in force (the one being edited). */
  const [viewing, setViewing] = useState<ProfileVersion | null>(null);
  const guard = useUnsavedNavigationGuard(isDirty);

  const versions = useProfileVersions(isNew ? undefined : managed.id, 'journal');
  const currentVersion = versions.data?.find((v) => v.state === 'published')?.version;
  const viewedRules = useJournalVersionProfile(managed.id, viewing?.version);
  const isViewingOld = viewing !== null;
  /** What the tabs and the preview show: the edited journal, or the rules of the past version on screen. */
  const shown = useMemo<ManagedJournalProfile>(
    () =>
      viewing && viewedRules.data
        ? { ...managed, profile: { ...viewedRules.data, id: managed.profile.id, names: managed.profile.names, color: managed.profile.color } }
        : managed,
    [managed, viewing, viewedRules.data],
  );

  // Dynamic sample paper based on active in-memory profile
  const samplePaper = useMemo(
    () => generateSamplePaperForJournal(shown.profile),
    [shown.profile]
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
    getBaseline,
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
    initialManaged,
    serverVersion,
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
  const preloaded = React.useRef(false);
  useEffect(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    const precompiled = getPrecompiledPdfForJournal(managed.id);
    // the shipped samples are Vietnamese-first: in English the preview is typeset instead
    if (precompiled && !compiledPdfUrl && pdfLanguage === 'vi') {
      setCompiledPdfUrl(precompiled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managed.id]);

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

  // published -> draft -> archived -> published again
  const handleToggleStatus = useCallback(() => {
    const nextStatus: JournalStatus =
      managed.status === 'published' ? 'draft' : managed.status === 'archived' ? 'published' : 'archived';
    setManaged((prev) => ({ ...prev, status: nextStatus }));
    setIsDirty(true);
    toast.info(
      'Trạng thái mẫu',
      nextStatus === 'published'
        ? 'Chuyển sang: Đang phát hành (published)'
        : nextStatus === 'archived'
          ? 'Chuyển sang: Lưu trữ (archived): tạp chí không còn được chọn cho bài mới'
          : 'Chuyển sang: Bản nháp (draft)'
    );
  }, [managed.status]);

  const handleRecompile = useCallback(async () => {
    const updated = generateSamplePaperForJournal(shown.profile);
    setLivePaper(updated);
    await compileLatexToPdf(updated);
  }, [shown.profile, compileLatexToPdf]);

  // a past version: typeset the preview with its rules once they arrive
  useEffect(() => {
    if (!viewing || !viewedRules.data) return;
    const sample = generateSamplePaperForJournal(shown.profile);
    setLivePaper(sample);
    void compileLatexToPdf(sample);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewing?.version, viewedRules.data]);

  const handleViewVersion = useCallback(
    (version: ProfileVersion | null) => {
      setViewing(version);
      if (!version) {
        const sample = generateSamplePaperForJournal(managed.profile);
        setLivePaper(sample);
        void compileLatexToPdf(sample);
      }
    },
    [managed.profile, compileLatexToPdf],
  );

  // the title bar shows which journal this is (in the PDF language) and which version is on screen
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  useEffect(() => {
    setJournalBar({
      names: { vi: managed.profile.names?.vi ?? '', en: managed.profile.names?.en ?? '' },
      short: managed.profile.names?.short || managed.profile.id?.toUpperCase() || 'JOURNAL',
      color: managed.profile.color || '#000099',
      viewing: currentVersion ? { version: viewing?.version ?? currentVersion, isCurrent: !viewing } : null,
      onOpenHistory: isNew ? undefined : openHistory,
    });
  }, [managed.profile.names, managed.profile.id, managed.profile.color, currentVersion, viewing, isNew, openHistory, setJournalBar]);
  useEffect(() => () => setJournalBar(null), [setJournalBar]);

  const diffGroups = useMemo(
    () =>
      isSaveWarningOpen
        ? describeChanges(isNew ? null : { status: getBaseline().status, profile: getBaseline().profile as any }, { status: managed.status, profile: managed.profile as any })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSaveWarningOpen, managed, isNew],
  );

  // Left Side: Editor Form Tabs with Header
  const leftEditorContent = (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden space-y-2.5">
      {isViewingOld && (
        <div
          role="status"
          data-testid="viewing-old-version-banner"
          className="flex-shrink-0 flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2 text-xs text-amber-900"
        >
          <Eye className="w-4 h-4 shrink-0" />
          <span className="flex-1 font-semibold">
            Đang xem phiên bản <b>v{viewing?.version}</b> (bản cũ, chỉ đọc). Bản đang áp dụng là v{currentVersion ?? '?'}.
          </span>
          <button
            type="button"
            onClick={() => handleViewVersion(null)}
            className="shrink-0 px-3 py-1 rounded-full bg-amber-900 hover:bg-amber-800 text-white font-bold cursor-pointer transition-all active:scale-95"
          >
            Về bản hiện tại
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex-shrink-0">
        <JournalEditorTabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          articleTypesCount={shown.profile.articleTypes?.length}
        />
      </div>

      <fieldset disabled={isViewingOld || !canEdit} className="flex-1 min-h-0 min-w-0 h-full w-full overflow-y-auto pr-1 border-0 p-0 m-0">
        {activeTab === 'general' && (
          <JournalGeneralTab
            profile={shown.profile}
            onChange={handleUpdateProfile}
            isNew={isNew}
          />
        )}
        {activeTab === 'frontmatter' && (
          <JournalFrontMatterTab
            profile={shown.profile}
            onChange={handleUpdateProfile}
          />
        )}
        {activeTab === 'article-types' && (
          <JournalArticleTypesTab profile={shown.profile} journalKey={managed.id} isNew={isNew} canEdit={canEdit && !isViewingOld} />
        )}
        {activeTab === 'layout' && (
          <JournalLayoutTab
            profile={shown.profile}
            onChange={handleUpdateProfile}
          />
        )}
        {activeTab === 'publication' && (
          <JournalPublicationTab profile={shown.profile} onChange={handleUpdateProfile} />
        )}
      </fieldset>
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
        readOnly={!canEdit || isViewingOld}
        onBack={() => guard.guardedPush('/templates')}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 gap-2 sm:gap-3">
        {/* Mobile Header Toolbar (Only visible on phones) */}
        <div className="flex sm:hidden flex-shrink-0 items-center justify-between p-1.5 bg-white/80 backdrop-blur-md rounded-2xl border border-zinc-200">
          <button
            type="button"
            onClick={() => guard.guardedPush('/templates')}
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

      {/* Before saving: what changed, as removed/added lines */}
      <JournalSaveDiffModal
        isOpen={isSaveWarningOpen}
        onClose={cancelSave}
        onConfirm={confirmSave}
        isSaving={isSaving}
        isNew={isNew}
        groups={diffGroups}
        journalLabel={{
          short: managed.profile.names?.short || managed.id.toUpperCase(),
          name: managed.profile.names?.vi || managed.profile.names?.en || managed.id,
          color: managed.profile.color || '#000099',
        }}
      />

      {/* Version history: look at an older version, restore one, move every paper to the one in force */}
      {!isNew && (
        <JournalVersionsModal
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          journalKey={managed.id}
          canEdit={canEdit}
          viewingVersion={viewing?.version ?? null}
          onView={handleViewVersion}
        />
      )}

      {/* Leaving with edits that were not saved */}
      <ActionConfirmModal
        isOpen={guard.isOpen}
        onClose={guard.stay}
        onConfirm={guard.leave}
        variant="warning"
        title="Có thay đổi chưa được lưu"
        description="Bạn đã chỉnh sửa tạp chí này nhưng chưa lưu. Nếu rời đi bây giờ, các thay đổi sẽ bị mất."
        cancelLabel="Ở lại chỉnh sửa"
        confirmLabel="Rời đi, bỏ thay đổi"
        confirmIcon={<LogOut className="w-4 h-4" />}
        testId="template-unsaved-leave-modal"
        confirmTestId="confirm-leave-template-btn"
      />

      {/* Reset Confirmation Modal */}
      <ActionConfirmModal
        isOpen={isResetWarningOpen}
        onClose={cancelReset}
        onConfirm={confirmReset}
        variant="danger"
        title="Bỏ các chỉnh sửa chưa lưu?"
        description="Các chỉnh sửa chưa lưu sẽ bị bỏ và hồ sơ quay về quy định đang xuất bản. Bạn có chắc chắn muốn tiếp tục?"
        cancelLabel="Hủy bỏ"
        confirmLabel="Bỏ chỉnh sửa"
        confirmIcon={<RotateCcw className="w-4 h-4" />}
        testId="template-reset-confirm-modal"
        confirmTestId="confirm-reset-template-btn"
      />
    </div>
  );
};
