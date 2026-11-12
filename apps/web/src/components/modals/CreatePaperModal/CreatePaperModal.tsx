'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BookOpen, FileText } from 'lucide-react';
import { ModalPortal } from '@/components/modals/ModalPortal';
import { StepUploadFile } from './StepUploadFile';
import { StepSelectTemplate } from './StepSelectTemplate';
import { BatchImportPanel } from './BatchImportPanel';
import { StepBatchTemplates } from './StepBatchTemplates';
import { toBatchJournal } from '@/lib/batch-import/journals';
import { useBatchImport } from '@/hooks/useBatchImport';
import { summarize } from '@/lib/batch-import/summary';
import type { BatchItem } from '@/lib/batch-import/types';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { createEmptyPaper, CompletePaper } from '@/types/paper';
import { usePaper } from '@/context/PaperContext';
import { usePaperStorage, usePaperDuplicateWarning } from '@/hooks';
import { toast } from '@/components/DynamicIslandToast';
import { DuplicatePaperWarningModal } from '@/components/modals/DuplicatePaperWarningModal';
import { ImportValidationModal } from '@/components/documents/ValidationModals';
import { validateForImport, type ValidationReport } from '@/lib/validation/validators';
import { renumberPaper } from '@/lib/validation/numbering';

interface CreatePaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedManaged?: ManagedJournalProfile | null;
  onPaperCreated?: (paper: CompletePaper) => void;
  /** A multi-file import finished (the papers list can reload). */
  onBatchFinished?: () => void;
  layoutId?: string;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const CreatePaperModal: React.FC<CreatePaperModalProps> = ({
  isOpen,
  onClose,
  preselectedManaged = null,
  onPaperCreated,
  onBatchFinished,
  layoutId,
}) => {
  const modalLayoutId =
    layoutId !== undefined
      ? layoutId
      : preselectedManaged
      ? undefined
      : 'create-paper-modal-card';
  const router = useRouter();
  const { setPaper, setCurrentJournal } = usePaper();
  const { savePaper } = usePaperStorage();

  const [step, setStep] = useState<1 | 2>(1);
  const [parsedPaper, setParsedPaper] = useState<CompletePaper | null>(null);
  const [isBlank, setIsBlank] = useState<boolean>(false);
  const [docName, setDocName] = useState<string>('');
  // Several Word files picked at once: one paper per file, imported side by side.
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchSkipped, setBatchSkipped] = useState(0);
  const batch = useBatchImport({
    onFinished: (items) => {
      const sum = summarize(items);
      if (sum.created > 0) {
        toast.success(
          `Đã tạo ${sum.created}/${sum.total} bài báo`,
          sum.withPdf === sum.created ? 'Tất cả đã có bản PDF.' : `${sum.withPdf} bài có PDF${sum.failed ? `, ${sum.failed} tệp lỗi` : ''}.`
        );
      } else if (sum.cancelled > 0 && sum.failed === 0) {
        toast.info('Đã hủy nhập hàng loạt', 'Chưa có bài báo nào được tạo.');
      } else if (sum.total > 0) {
        toast.error('Không tạo được bài báo nào', 'Kiểm tra lại các tệp Word.');
      }
      onBatchFinished?.();
    },
  });
  const inBatch = batch.items.length > 0;
  const batchPending = batchFiles.length > 0 && !inBatch;
  // GATE 1: report shown after importing a Word file, before the editor opens.
  const [importGate, setImportGate] = useState<{
    paper: CompletePaper;
    managed: ManagedJournalProfile;
    report: ValidationReport;
  } | null>(null);

  const {
    duplicatePrompt,
    checkAndPromptDuplicate,
    getAutoUniqueTitle,
    handleConfirmDuplicate,
    handleCloseDuplicate,
  } = usePaperDuplicateWarning();

  const [cachedManaged, setCachedManaged] = useState<ManagedJournalProfile | null>(preselectedManaged);

  useEffect(() => {
    if (preselectedManaged) {
      setCachedManaged(preselectedManaged);
    }
  }, [preselectedManaged]);

  const activeManaged = preselectedManaged || cachedManaged;

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      // A multi-file import keeps running when the dialog is closed; reopening shows it again.
      if (batch.running) return;
      batch.reset();
      setBatchFiles([]);
      setBatchSkipped(0);
      setStep(1);
      setParsedPaper(null);
      setIsBlank(false);
      setDocName('');
      setImportGate(null);
      handleCloseDuplicate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, handleCloseDuplicate]);

  const targetJournalCode = activeManaged
    ? `VNUHCM-${activeManaged.id.toUpperCase()}`
    : undefined;
  const targetJournalName = activeManaged
    ? activeManaged.profile.names?.vi || activeManaged.profile.names?.short
    : undefined;

  const executeSaveAndRedirect = async (finalPaper: CompletePaper, managed: ManagedJournalProfile) => {
    const journalCode = `VNUHCM-${managed.id.toUpperCase()}`;
    setPaper(finalPaper);
    setCurrentJournal(journalCode);

    try {
      await savePaper(finalPaper);
    } catch (saveErr) {
      console.warn('Background save error:', saveErr);
    }

    toast.success(
      'Khởi tạo bài báo thành công',
      `Đã tạo bài báo mới theo chuẩn "${managed.profile.names?.short || managed.id.toUpperCase()}"`
    );

    if (onPaperCreated) {
      onPaperCreated(finalPaper);
    }

    onClose();
    router.push('/editor');
  };

  // Finalize paper creation with chosen template
  const finalizeCreation = async (managed: ManagedJournalProfile, docxPaper?: CompletePaper | null) => {
    try {
      const journalCode = `VNUHCM-${managed.id.toUpperCase()}`;

      if (docxPaper) {
        const title = docxPaper.metadata.title?.trim() || 'Bản thảo bài báo';
        await checkAndPromptDuplicate(title, {
          journalId: journalCode,
          onProceed: async (resolvedTitle) => {
            const finalPaper: CompletePaper = {
              ...docxPaper,
              metadata: {
                ...docxPaper.metadata,
                title: resolvedTitle,
                journalId: journalCode,
                journalName: managed.profile.names?.vi || managed.profile.names?.en || managed.id,
                journalAbbv: managed.profile.names?.short || managed.id.toUpperCase(),
              },
            };
            (finalPaper as any).displayName = docName.trim() || resolvedTitle;
            const report = validateForImport(finalPaper);
            if (report.issues.length === 0) {
              await executeSaveAndRedirect(finalPaper, managed);
            } else {
              setImportGate({ paper: finalPaper, managed, report });
            }
          },
        });
      } else {
        const finalPaper = createEmptyPaper(journalCode);
        finalPaper.metadata.journalName =
          managed.profile.names?.vi || managed.profile.names?.en || managed.id;
        finalPaper.metadata.journalAbbv =
          managed.profile.names?.short || managed.id.toUpperCase();

        const uniqueTitle = docName.trim() || (await getAutoUniqueTitle('Bản thảo bài báo'));
        finalPaper.metadata.title = uniqueTitle;
        (finalPaper as any).displayName = uniqueTitle;

        await executeSaveAndRedirect(finalPaper, managed);
      }
    } catch (err: any) {
      console.error('Lỗi khởi tạo bài báo:', err);
      toast.error('Lỗi khởi tạo bài báo', err?.message || 'Có lỗi xảy ra');
    }
  };

  // Step 1 completed
  const handleStep1Complete = async (result: {
    parsedPaper?: CompletePaper;
    isBlank: boolean;
  }) => {
    setParsedPaper(result.parsedPaper || null);
    setIsBlank(result.isBlank);

    // If preselected journal is already known (e.g. from /templates), finalize immediately!
    if (preselectedManaged) {
      await finalizeCreation(preselectedManaged, result.parsedPaper);
      return;
    }

    // Otherwise proceed to Step 2 (Choose Template)
    setStep(2);
  };

  /** One template per file (they may all be the same). */
  const startBatch = (choices: ManagedJournalProfile[], files: File[], skipped: number) =>
    batch.start(files, toBatchJournal(choices[0]), skipped, choices.map(toBatchJournal));

  // Two or more Word files: pick the journal template once (or use the preselected one) and import them all
  const handleBatchPick = async (files: File[], skipped: number) => {
    setBatchFiles(files);
    setBatchSkipped(skipped);
    if (preselectedManaged) {
      await startBatch(files.map(() => preselectedManaged), files, skipped);
      return;
    }
    setStep(2);
  };

  // Step 2 completed
  const handleStep2Complete = async (managed: ManagedJournalProfile) => {
    await finalizeCreation(managed, isBlank ? null : parsedPaper);
  };

  const closeModal = () => {
    batch.reset(); // no-op while a run is going: it carries on in the background
    onClose();
  };

  const openBatchItem = (item: BatchItem) => {
    closeModal();
    router.push(`/editor?id=${encodeURIComponent(item.paperId || '')}`);
  };

  return (
    <>
      <ModalPortal isOpen={isOpen} onClose={onClose}>
      <motion.div
        data-testid="create-paper-modal"
        layoutId={modalLayoutId}
        initial={
          isTest
            ? undefined
            : modalLayoutId
            ? undefined
            : { opacity: 0, scale: 0.9, y: 30 }
        }
        animate={
          isTest
            ? undefined
            : modalLayoutId
            ? undefined
            : { opacity: 1, scale: 1, y: 0 }
        }
        exit={
          isTest
            ? undefined
            : modalLayoutId
            ? undefined
            : {
                opacity: 0,
                scale: 0.9,
                y: 30,
                transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
              }
        }
        transition={
          isTest
            ? { duration: 0 }
            : {
                type: 'spring',
                stiffness: 120,
                damping: 18,
                mass: 0.8,
              }
        }
        className={`bg-[#F8F9FA] w-full ${inBatch ? 'max-w-2xl h-[88vh]' : step === 2 || batchPending ? 'max-w-xl h-[88vh]' : 'max-w-xl'} max-h-[90vh] rounded-[40px] overflow-hidden shadow-2xl flex flex-col border border-white/20 select-text`}
      >
        {/* Header - Eatzy OrderDetailsModal Identity */}
        <div className="flex-shrink-0 px-7 sm:px-8 py-5 pb-0 flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight pl-3">
                {inBatch
                  ? 'Nhập nhiều bài báo'
                  : batchPending
                  ? `Chọn mẫu tạp chí cho ${batchFiles.length} bài báo?`
                  : step === 1
                  ? 'Tải lên bài báo hoặc bỏ qua!'
                  : 'Chọn mẫu tạp chí?'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="w-11 h-11 rounded-full bg-gray-200/70 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content with Horizontal Step Slider */}
        <div className="flex-1 min-h-0 flex flex-col p-6 sm:p-7 overflow-hidden">
          {!inBatch && !batchPending && (
          <label className="flex-shrink-0 block mb-4">
            <span className="block text-[11px] font-bold text-slate-500 mb-1 pl-1">Tên tài liệu</span>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              maxLength={200}
              placeholder="Đặt tên tài liệu (để trống sẽ lấy theo tiêu đề bài báo)"
              data-testid="new-document-name"
              className="w-full rounded-2xl bg-white border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300"
            />
          </label>
          )}
          {inBatch ? (
            <BatchImportPanel
              items={batch.items}
              running={batch.running}
              skipped={batchSkipped}
              onCancel={batch.cancel}
              onRetry={batch.retry}
              onOpen={openBatchItem}
              onClose={closeModal}
            />
          ) : (
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.div
                key="create-paper-step-1"
                initial={isTest ? undefined : { opacity: 0, x: -20 }}
                animate={isTest ? undefined : { opacity: 1, x: 0 }}
                exit={isTest ? undefined : { opacity: 0, x: -20 }}
                transition={isTest ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                className="flex-1 min-h-0 overflow-y-auto"
              >
                <StepUploadFile
                  onSuccess={handleStep1Complete}
                  onBatch={handleBatchPick}
                  targetJournalName={targetJournalName}
                  targetJournalCode={targetJournalCode}
                />
              </motion.div>
            ) : (
              <motion.div
                key="create-paper-step-2"
                initial={isTest ? undefined : { opacity: 0, x: 20 }}
                animate={isTest ? undefined : { opacity: 1, x: 0 }}
                exit={isTest ? undefined : { opacity: 0, x: 20 }}
                transition={isTest ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                {batchPending ? (
                  <StepBatchTemplates
                    files={batchFiles}
                    onConfirm={(choices) => startBatch(choices, batchFiles, batchSkipped)}
                    onBack={() => {
                      setBatchFiles([]);
                      setStep(1);
                    }}
                  />
                ) : (
                <StepSelectTemplate
                  onConfirm={handleStep2Complete}
                  onBack={() => {
                    setBatchFiles([]);
                    setStep(1);
                  }}
                  selectedJournalId={parsedPaper?.metadata?.journalId?.replace('VNUHCM-', '').toLowerCase()}
                />
                )}
              </motion.div>
            )}
          </AnimatePresence>
          )}

          {/* Bottom 2 Dots Indicator (as requested: "dưới cùng có 2 cái chấm nhỏ xíu là được rồi") */}
          {!preselectedManaged && !inBatch && (
            <div className="flex items-center justify-center gap-1.5 pt-5 pb-1">
              <span
                className={`transition-all duration-300 rounded-full ${
                  step === 1 ? 'w-5 h-1.5 bg-[#78C841]' : 'w-1.5 h-1.5 bg-slate-300'
                }`}
              />
              <span
                className={`transition-all duration-300 rounded-full ${
                  step === 2 ? 'w-5 h-1.5 bg-[#78C841]' : 'w-1.5 h-1.5 bg-slate-300'
                }`}
              />
            </div>
          )}
        </div>
      </motion.div>
    </ModalPortal>

    <ImportValidationModal
      isOpen={importGate !== null}
      report={importGate?.report ?? null}
      fileLabel={importGate?.paper.metadata.title}
      onClose={() => setImportGate(null)}
      onAutoFix={() => {
        if (!importGate) return;
        const fixed = renumberPaper(importGate.paper);
        setImportGate({ ...importGate, paper: fixed, report: validateForImport(fixed) });
      }}
      onContinue={async () => {
        if (!importGate) return;
        const { paper: toSave, managed } = importGate;
        setImportGate(null);
        await executeSaveAndRedirect(toSave, managed);
      }}
    />

    <DuplicatePaperWarningModal
      isOpen={Boolean(duplicatePrompt?.isOpen)}
      paperTitle={duplicatePrompt?.paperTitle || ''}
      suggestedTitle={duplicatePrompt?.suggestedTitle || ''}
      matchCount={duplicatePrompt?.matchCount || 1}
      journalId={duplicatePrompt?.journalId}
      zIndex={120}
      onClose={handleCloseDuplicate}
      onConfirmUpload={handleConfirmDuplicate}
    />
    </>
  );
};
