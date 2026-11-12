import JSZip from 'jszip';
import type { CompletePaper } from '@/types/paper';
import { exportToJatsXml, figureRelPath, listJatsFigures } from './jats-export';
import { resolvePublication, hasPublicationValue } from './publication';
import { imageSrcToBase64 } from './media/figure-image-utils';

export interface JatsPackage {
  blob: Blob;
  /** Name of the XML file inside the package: the article id, else the given fallback. */
  xmlName: string;
  /** Things the editor should fix before uploading to the platform. */
  warnings: string[];
}

/** What is missing for the platform address of the images and the file name (volume, issue, article id). */
export function jatsReadinessWarnings(paper: CompletePaper): string[] {
  const md = paper.metadata;
  const pub = resolvePublication(md);
  const out: string[] = [];
  if (!(md.publication?.articleId || '').trim()) out.push('Chưa có Mã bài (Article ID): tên file XML và đường dẫn hình sẽ dùng tạm.');
  if (!hasPublicationValue(pub.volume)) out.push('Chưa có Tập (Volume): hình dùng đường dẫn tương đối images/.');
  if (!hasPublicationValue(pub.issue)) out.push('Chưa có Số (Issue): hình dùng đường dẫn tương đối images/.');
  return out;
}

/**
 * XML + figures in one zip, laid out like the platform expects: `<articleId>.xml` at the root and the images under
 * `articles/<journal>/v-#/i-#/a-#/img-n.ext` (upload that folder to the static host). Without volume/issue/article id
 * the images go to `images/img-n.ext`.
 */
export async function buildJatsPackage(paper: CompletePaper, fallbackName: string): Promise<JatsPackage> {
  const warnings = jatsReadinessWarnings(paper);
  const figures = listJatsFigures(paper);
  const resolved = await Promise.all(figures.map(async (f) => ({ f, img: f.src ? await imageSrcToBase64(f.src) : null })));

  const extByFigure: Record<number, string> = {};
  for (const { f, img } of resolved) if (img) extByFigure[f.num] = img.ext;

  const zip = new JSZip();
  for (const { f, img } of resolved) {
    if (!img) {
      warnings.push(`Hình ${f.num}: không đọc được ảnh nhúng (ảnh từ địa chỉ ngoài không được đóng gói), cần bổ sung thủ công.`);
      continue;
    }
    const { path, onPlatform } = figureRelPath(paper, f.num, f.src, { extByFigure });
    zip.file(onPlatform ? `articles/${path}` : path, img.base64, { base64: true });
  }

  const articleId = (paper.metadata.publication?.articleId || '').trim();
  const xmlName = `${(articleId || fallbackName).replace(/[\/:*?"<>|]/g, '_')}.xml`;
  zip.file(xmlName, exportToJatsXml(paper, { extByFigure }));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, xmlName, warnings };
}
