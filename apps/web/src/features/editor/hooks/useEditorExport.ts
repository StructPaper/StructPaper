'use client';

import { useState, useCallback } from 'react';
import { CompletePaper } from '@/types/paper';
import { generateLatexPackageZip, exportToJatsXml } from '@/lib/exporters';
import { exportPaperToDocx } from '@/lib/docx-export';
import { buildJatsPackage, jatsReadinessWarnings } from '@/lib/jats-package';
import { sileo } from '@/components/DynamicIslandToast';

export type ExportedFormat = 'docx' | 'pdf' | 'xml';

export interface UseEditorExportOptions {
  formData: CompletePaper;
  compiledPdfUrl: string | null;
  compileLatexToPdf: (customPaper?: CompletePaper) => Promise<string | null>;
  onNotify?: (msg: string) => void;
  /** Called after a deliverable was produced (used to archive it on the server). */
  onExported?: (format: ExportedFormat, blob: Blob, fileName: string) => void;
}

/** File-system safe base name derived from the document (not the article DOI). */
export function exportBaseName(paper: CompletePaper): string {
  const raw =
    ((paper as any).displayName as string | undefined) ||
    paper.metadata.title ||
    paper.metadata.journalId ||
    'Document';
  return (
    raw
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Document'
  );
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
}

export function useEditorExport({
  formData,
  compiledPdfUrl,
  compileLatexToPdf,
  onNotify,
  onExported,
}: UseEditorExportOptions) {
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingXml, setIsExportingXml] = useState(false);

  const notify = useCallback(
    (msg: string) => {
      if (onNotify) {
        onNotify(msg);
      } else {
        sileo.info({
          title: 'Thông báo hệ thống',
          description: msg,
        });
      }
    },
    [onNotify]
  );

  const handleDownloadDocx = useCallback(async () => {
    try {
      setIsExportingDocx(true);
      const blob = await exportPaperToDocx(formData);
      const fileName = `${exportBaseName(formData)}.docx`;
      downloadBlob(blob, fileName);
      onExported?.('docx', blob, fileName);
      notify('Đã xuất file Word (.docx) thành công!');
    } catch (e: any) {
      sileo.error({ title: 'Lỗi xuất DOCX', description: e?.message || String(e) });
    } finally {
      setIsExportingDocx(false);
    }
  }, [formData, notify, onExported]);

  const handleDownloadXml = useCallback(async () => {
    try {
      setIsExportingXml(true);
      const xml = exportToJatsXml(formData);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const articleId = (formData.metadata.publication?.articleId || '').trim();
      const fileName = `${(articleId || exportBaseName(formData)).replace(/[\\/:*?"<>|]/g, '_')}.xml`;
      downloadBlob(blob, fileName);
      onExported?.('xml', blob, fileName);
      const warn = jatsReadinessWarnings(formData);
      notify(warn.length ? `Đã xuất XML (JATS). Lưu ý: ${warn[0]}` : 'Đã xuất file XML (JATS) thành công!');
    } catch (e: any) {
      sileo.error({ title: 'Lỗi xuất XML', description: e?.message || String(e) });
    } finally {
      setIsExportingXml(false);
    }
  }, [formData, notify, onExported]);

  const handleDownloadXmlPackage = useCallback(async () => {
    try {
      setIsExportingXml(true);
      const pkg = await buildJatsPackage(formData, exportBaseName(formData));
      downloadBlob(pkg.blob, `${pkg.xmlName.replace(/\.xml$/, '')}_XML.zip`);
      notify(pkg.warnings.length ? `Đã tải gói XML + hình. Lưu ý: ${pkg.warnings[0]}` : 'Đã tải gói XML + hình (.zip)!');
    } catch (e: any) {
      sileo.error({ title: 'Lỗi tạo gói XML', description: e?.message || String(e) });
    } finally {
      setIsExportingXml(false);
    }
  }, [formData, notify]);

  const handleDownloadZip = useCallback(async () => {
    try {
      setIsExportingZip(true);
      const blob = await generateLatexPackageZip(formData);
      downloadBlob(blob, `${exportBaseName(formData)}_LaTeX_Package.zip`);
      notify('Đã tải gói nén ZIP LaTeX (.tex + .bib)!');
    } catch (e: any) {
      sileo.error({ title: 'Lỗi tạo gói ZIP', description: e?.message || String(e) });
    } finally {
      setIsExportingZip(false);
    }
  }, [formData, notify]);

  const handleDownloadPdf = useCallback(async (urlOverride?: unknown) => {
    try {
      setIsExportingPdf(true);
      // onClick handlers pass an event here; only a string is a real URL override.
      let targetUrl = typeof urlOverride === 'string' ? urlOverride : compiledPdfUrl;
      if (!targetUrl) {
        notify('Đang biên dịch PDF trước khi tải...');
        targetUrl = await compileLatexToPdf(formData);
      }
      if (targetUrl) {
        const fileName = `${exportBaseName(formData)}.pdf`;
        triggerDownload(targetUrl, fileName);
        try {
          const blob = await (await fetch(targetUrl)).blob();
          onExported?.('pdf', blob, fileName);
        } catch {
          /* archiving is best-effort; the download itself already succeeded */
        }
        notify('Đã tải xuống file PDF thành công!');
      } else {
        sileo.error({ title: 'Không thể tạo file PDF', description: 'Biên dịch thất bại, xem chi tiết ở khung xem trước.' });
      }
    } catch (e: any) {
      sileo.error({ title: 'Lỗi tải PDF', description: e?.message || String(e) });
    } finally {
      setIsExportingPdf(false);
    }
  }, [formData, compiledPdfUrl, compileLatexToPdf, notify, onExported]);

  return {
    isExportingDocx,
    isExportingZip,
    isExportingPdf,
    isExportingXml,
    handleDownloadDocx,
    handleDownloadZip,
    handleDownloadPdf,
    handleDownloadXml,
    handleDownloadXmlPackage,
  };
}
