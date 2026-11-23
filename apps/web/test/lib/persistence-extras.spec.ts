import { describe, it, expect } from 'vitest';
import { migrateV1toV2, adaptV2toV1 } from '@structpaper/doc-model';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';

const roundTrip = (p: CompletePaper): CompletePaper => adaptV2toV1(migrateV1toV2(p as any) as any) as unknown as CompletePaper;

describe('what a table, a figure and the paper carry beyond the v2 slots survives saving and loading', () => {
  const p: any = createEmptyPaper('VNUHCM-HS');
  p.metadata.appendix = { placement: 'inContent', numbering: 'letter' };
  p.metadata.primaryLanguage = 'en';
  p.sections = [
    { id: 'h', type: 'h1', title: 'KQ', content: '' },
    {
      id: 't',
      type: 'table',
      content: '',
      appendixOrigin: { after: 'h', afterReferences: true },
      table: {
        id: 't', num: 1, caption: 'Phụ lục 1. Bảng', headers: ['A', 'B'], rows: [['1', '2']],
        appendix: true, sideColumn: 'full', isRotated: true, sourceStyle: { bold: true, align: 'center' }, source: 'a\nb',
        borderStyle: 'grid', headerFill: '#ff0000', colWeights: [1, 2], headerHeight: 20, rowHeight: 12, bodyTint: '#00ff00', borderColor: '#000000', borderWidth: 1,
      },
    },
    {
      id: 'f', type: 'figure', content: '',
      figure: { id: 'f', num: 2, caption: 'Phụ lục 2. Hình', src: 'data:image/png;base64,AAAA', appendix: true, sideColumn: 'full', isRotated: true, scalePercent: 70, alignment: 'left', hasBorder: false, placement: 'top', source: 'Nguồn: x', columnSpan: '2-column' },
    },
  ];

  it('table: appendix, side column, source look, lines, widths, heights', () => {
    const out = roundTrip(p);
    const s: any = out.sections.find((x) => x.id === 't');
    expect(s.appendixOrigin).toEqual({ after: 'h', afterReferences: true });
    expect(s.table).toMatchObject({ appendix: true, sideColumn: 'full', isRotated: true, sourceStyle: { bold: true, align: 'center' }, borderStyle: 'grid', headerFill: '#ff0000', colWeights: [1, 2], headerHeight: 20, rowHeight: 12, bodyTint: '#00ff00', borderColor: '#000000', borderWidth: 1 });
  });
  it('figure: appendix, side column, turned, scale', () => {
    const f: any = roundTrip(p).sections.find((x) => x.id === 'f')!.figure;
    expect(f).toMatchObject({ appendix: true, sideColumn: 'full', isRotated: true, scalePercent: 70, alignment: 'left', hasBorder: false, placement: 'top' });
  });
  it('the paper: appendix settings and the language of the first page', () => {
    const m: any = roundTrip(p).metadata;
    expect(m.appendix).toEqual({ placement: 'inContent', numbering: 'letter' });
    expect(m.primaryLanguage).toBe('en');
  });
});

describe('what a cell carries beyond its text survives saving and loading', () => {
  it('fill, vertical alignment and the lines of a cell, in the head and in the body', () => {
    const p: any = createEmptyPaper('VNUHCM-HS');
    p.sections = [
      {
        id: 't', type: 'table', content: '',
        table: {
          id: 't', num: 1, caption: 'Bảng', headers: ['A', 'B'], rows: [['1', '2'], ['3', '4']],
          headerRows: [[{ text: 'A', isHeader: true, fill: '#112233' }, { text: 'B', isHeader: true }]],
          bodyRows: [
            [{ text: '1', valign: 'middle' }, { text: '2', borders: { top: 'line', bottom: 'none' } }],
            [{ text: '3', fill: '#ffeeaa', align: 'center' }, { text: '4' }],
          ],
        },
      },
    ];
    const out: any = roundTrip(p).sections[0].table;
    expect(out.headerRows[0][0].fill).toBe('#112233');
    expect(out.bodyRows[0][0].valign).toBe('middle');
    expect(out.bodyRows[0][1].borders).toEqual({ top: 'line', bottom: 'none' });
    expect(out.bodyRows[1][0]).toMatchObject({ fill: '#ffeeaa', align: 'center' });
    expect(out.bodyRows[1][1].fill).toBeUndefined();
    expect(out.cellStyles).toBeUndefined();
  });
});
