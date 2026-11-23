import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractOpenXmlTables } from '@/lib/docx-parser';

const cell = (text: string, jc?: string) =>
  `<w:tc><w:p><w:pPr>${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;

describe('the alignment of a cell in the Word file', () => {
  it('is read from the paragraphs of the cell: centre and right are kept, left is what every cell is', async () => {
    const xml = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>
      <w:p><w:r><w:t>Bảng 1: Kết quả</w:t></w:r></w:p>
      <w:tbl>
        <w:tr><w:trPr><w:tblHeader/></w:trPr>${cell('Mẫu', 'center')}${cell('pH', 'center')}</w:tr>
        <w:tr>${cell('M1', 'center')}${cell('7,2', 'right')}</w:tr>
        <w:tr>${cell('M2')}${cell('7,4', 'left')}</w:tr>
      </w:tbl></w:body></w:document>`;
    const zip = new JSZip();
    zip.file('word/document.xml', xml);
    const tables = await extractOpenXmlTables(zip);
    expect(tables).toHaveLength(1);
    const body = (tables[0] as any).bodyRows ?? (tables[0] as any).table?.bodyRows;
    expect(body[0][0].align).toBe('center');
    expect(body[0][1].align).toBe('right');
    expect(body[1][0].align).toBeUndefined();
    expect(body[1][1].align).toBeUndefined();
  });
});
