import JSZip from 'jszip';
import { CompletePaper } from './sample-papers';
import { generateFullJournalLatex, generateLatexPackageZip, type LatexOptions } from './latex-template';
import { exportToJatsXml } from './jats-export';
import {
  appendFigureImagesToZip,
  rewriteBlobFigureSrcsForArchive,
} from './media/figure-image-utils';

export { generateLatexPackageZip };

export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { LayoutSettings } from '@/types/paper';

export function exportToLatex(paper: CompletePaper, customSettings?: LayoutSettings, options?: LatexOptions): string {
  return generateFullJournalLatex(paper, customSettings, options);
}

export function exportToJson(paper: CompletePaper): string {
  return JSON.stringify(paper, null, 2);
}

export function exportToHtml(paper: CompletePaper): string {
  const { metadata, sections, references } = paper;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${metadata.title}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; max-width: 850px; margin: 40px auto; line-height: 1.6; color: #111; padding: 0 20px; }
    h1 { color: #2B74B7; font-size: 22px; text-transform: uppercase; margin-bottom: 8px; }
    .title-en { font-style: italic; color: #4B5563; font-size: 16px; margin-bottom: 16px; }
    h2 { color: #2B74B7; font-size: 16px; border-bottom: 1px solid #2B74B7; padding-bottom: 4px; margin-top: 24px; text-transform: uppercase; }
    h3 { font-size: 14px; font-weight: bold; margin-top: 16px; }
    .authors { font-weight: bold; margin-bottom: 8px; }
    .affiliations { font-size: 13px; font-style: italic; color: #4B5563; margin-bottom: 8px; }
    .corresponding { font-size: 13px; color: #374151; margin-bottom: 16px; }
    .abstract-box { background-color: #E7ECF7; border: 1px solid #CBD8EF; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .figure-box { background-color: #F8FAFC; padding: 12px; border: 1px solid #E2E8F0; border-radius: 6px; text-align: center; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th { background-color: #E5E5E5; border: 1px solid #ccc; padding: 8px; text-align: left; }
    td { border: 1px solid #ccc; padding: 8px; }
    tr:nth-child(even) { background-color: #E7ECF7; }
    .ref-item { margin-bottom: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${metadata.title}</h1>
  ${metadata.titleEn ? `<div class="title-en">${metadata.titleEn}</div>` : ''}
  <div class="authors">${metadata.authors.map((a) => `${a.name}${a.isCorresponding ? '*' : ''} (${a.affiliationIds.join(',')})`).join(', ')}</div>
  <div class="affiliations">${metadata.affiliations.map((a) => `${a.id}. ${a.name}`).join('<br>')}</div>
  ${metadata.corresponding?.email ? `<div class="corresponding">Tác giả liên hệ: ${metadata.corresponding.name} - Email: ${metadata.corresponding.email}</div>` : ''}
  
  <div class="abstract-box">
    <strong>TÓM TẮT:</strong> ${metadata.abstract}
    <br><br>
    <strong>Từ khoá:</strong> ${metadata.keywords.join(', ')}
  </div>

  <div class="content">
    ${sections
      .map((sec) => {
        if (sec.type === 'h1') return `<h2>${sec.title}</h2>`;
        if (sec.type === 'h2') return `<h3>${sec.title}</h3>`;
        if (sec.type === 'paragraph') return `<p>${sec.content}</p>`;
        if (sec.type === 'figure' && sec.figure) {
          return `<div class="figure-box">
            ${sec.figure.src ? `<img src="${sec.figure.src}" style="max-width:100%; height:auto;" alt="${sec.figure.caption}" />` : ''}
            <p><strong>Hình ${sec.figure.num}:</strong> ${sec.figure.caption}</p>
          </div>`;
        }
        if (sec.type === 'table' && sec.table) {
          return `<div>
            <p><strong>Bảng ${sec.table.num}:</strong> ${sec.table.caption}</p>
            <table>
              <thead><tr>${sec.table.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
              <tbody>${sec.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>`;
        }
        return '';
      })
      .join('\n')}
  </div>

  ${
    references.length > 0
      ? `<h2>TÀI LIỆU THAM KHẢO</h2>
    <div>${references.map((ref) => `<p class="ref-item"><strong>[${ref.id}]</strong> ${ref.raw}</p>`).join('')}</div>`
      : ''
  }
</body>
</html>`;
}

export { exportToJatsXml };

export async function generatePaperZip(paper: CompletePaper): Promise<Blob> {
  const zip = new JSZip();
  const folderName = paper.id || 'paper_package';
  const folder = zip.folder(folderName) || zip;

  // Extract & pack figures first so archive HTML/TeX reference packed paths (e.g. images/fig1.jpg)
  const imgFolder = folder.folder('images');
  const packedPaths = await appendFigureImagesToZip(imgFolder, paper.sections);
  const archivePaper = rewriteBlobFigureSrcsForArchive(paper, packedPaths);

  folder.file('paper.tex', exportToLatex(archivePaper));
  folder.file('paper.html', exportToHtml(archivePaper));
  folder.file('paper.xml', exportToJatsXml(archivePaper));
  folder.file('paper.json', exportToJson(paper));

  return await zip.generateAsync({ type: 'blob' });
}
