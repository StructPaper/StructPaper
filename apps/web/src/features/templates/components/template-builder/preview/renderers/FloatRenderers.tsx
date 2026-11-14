'use client';

import React from 'react';
import { ElementRendererProps, buildContainerStyle } from './types';

export const FigureBoxRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
  floatingRules,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};
  const figRules = floatingRules?.figure;
  const captionPos = sp.captionPosition || figRules?.captionPosition || 'below';
  const captionAbove = captionPos === 'above';
  const hasSubfigures = sp.figureSubfigures ?? figRules?.showSubfiguresSupport ?? false;

  const captionLabelWeight =
    figRules?.captionLabelWeight === 'normal'
      ? 400
      : figRules?.captionLabelWeight === 'semibold'
        ? 600
        : 700;
  const captionLabelColor = figRules?.captionLabelColor || primaryColor || '#0F172A';
  const captionTextColor = figRules?.captionTextColor || '#334155';
  const captionTextItalic = figRules?.captionTextItalic ?? true;
  const sourceFontSize = figRules?.sourceFontSize || 6.5;
  const sourceTextColor = figRules?.sourceTextColor || '#64748B';

  const captionEl = (
    <div className="font-sans text-[7.8pt] leading-tight mt-1 text-left">
      <span
        style={{
          fontWeight: captionLabelWeight,
          color: captionLabelColor,
        }}
      >
        {sp.captionPrefix || `Hình ${sp.figureNumber || 1}`}:
      </span>{' '}
      <span
        style={{
          fontWeight: 700,
          fontStyle: captionTextItalic ? 'italic' : 'normal',
          color: captionTextColor,
        }}
      >
        {sp.captionText ||
          sp.customContentSample ||
          'Sơ đồ luồng xử lý và trích xuất cấu trúc văn bản học thuật'}
      </span>
      {sp.figureSource && (
        <div
          className="mt-0.5 italic text-slate-500"
          style={{
            fontSize: `${sourceFontSize}pt`,
            color: sourceTextColor,
          }}
        >
          (Nguồn: {sp.figureSource})
        </div>
      )}
    </div>
  );

  if (sp.figureImageSrc) {
    return (
      <div
        style={containerStyle}
        className="w-full bg-[#E7ECF7] rounded-none p-2 mb-2 flex flex-col items-center flex-shrink-0 select-none"
      >
        {captionAbove && captionEl}
        <div className="w-full flex-1 flex items-center justify-center bg-white p-1 overflow-hidden">
          <img
            src={sp.figureImageSrc}
            alt={sp.captionText || 'Figure'}
            className="w-full h-full object-contain rounded-none block max-h-[110mm]"
          />
        </div>
        {!captionAbove && captionEl}
      </div>
    );
  }

  return (
    <div style={containerStyle} className="my-2 select-none">
      {captionAbove && <div className="mb-1">{captionEl}</div>}
      {hasSubfigures ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center min-h-[80px]">
            <svg className="w-full h-14 text-slate-600" viewBox="0 0 160 55" fill="none">
              <path d="M 10 45 Q 50 15, 90 30 T 150 10" stroke="#2563EB" strokeWidth="2" fill="none" />
              <circle cx="90" cy="30" r="3" fill="#2563EB" />
              <line x1="10" y1="45" x2="150" y2="45" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2" />
            </svg>
            <span className="text-[6.5pt] font-bold text-slate-600 mt-0.5">
              (a) Độ chính xác theo Epoch
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center min-h-[80px]">
            <svg className="w-full h-14 text-slate-600" viewBox="0 0 160 55" fill="none">
              <path d="M 10 15 Q 50 40, 90 20 T 150 45" stroke="#78C841" strokeWidth="2" fill="none" />
              <circle cx="90" cy="20" r="3" fill="#78C841" />
              <line x1="10" y1="45" x2="150" y2="45" stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2" />
            </svg>
            <span className="text-[6.5pt] font-bold text-slate-600 mt-0.5">
              (b) Hàm mất mát Loss
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/90 flex flex-col items-center justify-center min-h-[95px]">
          <svg className="w-44 h-16 text-slate-600" viewBox="0 0 200 70" fill="none">
            <rect x="10" y="15" width="45" height="38" rx="4" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
            <text x="32" y="38" fontSize="8" fill="#334155" textAnchor="middle" fontWeight="bold">DOCX</text>
            <path d="M 55 34 L 75 34" stroke="#78C841" strokeWidth="2" />
            <rect x="75" y="10" width="50" height="48" rx="4" fill="#DCFCE7" stroke="#78C841" strokeWidth="1.5" />
            <text x="100" y="32" fontSize="7.5" fill="#14532D" textAnchor="middle" fontWeight="bold">Parser</text>
            <text x="100" y="44" fontSize="6.5" fill="#14532D" textAnchor="middle">OpenXML</text>
            <path d="M 125 34 L 145 34" stroke="#78C841" strokeWidth="2" />
            <rect x="145" y="15" width="45" height="38" rx="4" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
            <text x="167" y="38" fontSize="8" fill="#0369A1" textAnchor="middle" fontWeight="bold">Typst</text>
          </svg>
        </div>
      )}
      {!captionAbove && captionEl}
    </div>
  );
};

export const TableBoxRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
  floatingRules,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};
  const tableRules = floatingRules?.table;
  const captionPos = sp.captionPosition || tableRules?.captionPosition || 'above';
  const captionAbove = captionPos === 'above';
  const isBooktabs = sp.tableBorderMode === 'booktabs' || tableRules?.borderMode === 'booktabs';
  const isGrid = sp.tableBorderMode === 'grid' || tableRules?.borderMode === 'grid';
  const zebra = sp.zebraStriping ?? tableRules?.zebraStriping ?? false;

  const captionLabelWeight =
    tableRules?.captionLabelWeight === 'normal'
      ? 400
      : tableRules?.captionLabelWeight === 'semibold'
        ? 600
        : 700;
  const captionLabelColor = tableRules?.captionLabelColor || primaryColor || '#0F172A';
  const captionTextColor = tableRules?.captionTextColor || '#334155';
  const captionTextItalic = tableRules?.captionTextItalic ?? false;
  const headerTextColor = tableRules?.headerTextColor || '#0F172A';
  const dataFontSize = tableRules?.dataFontSize || 7;
  const dataTextColor = tableRules?.dataTextColor || '#334155';
  const noteFontSize = tableRules?.noteFontSize || 6.5;
  const noteTextColor = tableRules?.noteTextColor || '#64748B';

  const captionEl = (
    <div className="font-sans text-[7.8pt] leading-tight mb-1 text-left">
      <span
        style={{
          fontWeight: captionLabelWeight,
          color: captionLabelColor,
        }}
      >
        {sp.captionPrefix || `Bảng ${sp.tableNumber || 1}`}:
      </span>{' '}
      <span
        style={{
          fontWeight: 700,
          fontStyle: captionTextItalic ? 'italic' : 'normal',
          color: captionTextColor,
        }}
      >
        {sp.captionText ||
          sp.customContentSample ||
          'So sánh hiệu năng trích xuất và độ chính xác phân vùng'}
      </span>
    </div>
  );

  if (sp.tableHeaders && sp.tableRows) {
    return (
      <div style={containerStyle} className="my-2 select-none">
        {captionAbove && captionEl}
        <div className="w-full overflow-x-auto">
          <table
            className="w-full text-left font-sans border-collapse"
            style={{
              fontSize: `${dataFontSize}pt`,
              color: dataTextColor,
            }}
          >
            <thead>
              <tr
                className="font-bold border-t border-b border-slate-900"
                style={{
                  backgroundColor: sp.tableHeaderBackground || '#E7ECF7',
                }}
              >
                {sp.tableHeaders.map((h, i) => (
                  <th key={i} className="py-1 px-1.5 font-bold" style={{ color: headerTextColor }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sp.tableRows.map((row, idx) => {
                if (row.isSubheader) {
                  return (
                    <tr key={idx} className="bg-[#E7ECF7] font-bold border-b border-slate-300">
                      <td
                        colSpan={sp.tableHeaders?.length || 3}
                        className="py-1 px-1.5"
                        style={{ color: primaryColor }}
                      >
                        {row.subheaderText}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-200/80 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#E7ECF7]/30'
                    }`}
                  >
                    {row.cols?.map((c, colIdx) => (
                      <td key={colIdx} className="py-1 px-1.5 align-top whitespace-pre-line text-slate-800 leading-snug">
                        {c}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sp.tableSource && (
          <div className="text-[6.8pt] italic text-slate-500 mt-1">
            (Nguồn: {sp.tableSource})
          </div>
        )}
        {!captionAbove && <div className="mt-1">{captionEl}</div>}
      </div>
    );
  }

  return (
    <div style={containerStyle} className="my-2 select-none">
      {captionAbove && captionEl}
      <div className="w-full overflow-x-auto">
        <table
          className={`w-full text-left font-serif border-collapse ${
            isBooktabs
              ? 'border-t-2 border-b-2 border-zinc-900'
              : isGrid
                ? 'border border-zinc-300'
                : 'border-b border-zinc-200'
          }`}
          style={{
            fontSize: `${dataFontSize}pt`,
            color: dataTextColor,
          }}
        >
          <thead>
            <tr
              className={`${
                isBooktabs
                  ? 'border-b border-zinc-900 font-bold'
                  : isGrid
                    ? 'border-b border-zinc-300 bg-zinc-100 font-bold'
                    : 'border-b border-zinc-200 font-bold'
              }`}
              style={{
                backgroundColor: sp.tableHeaderBackground || tableRules?.headerBackground || undefined,
              }}
            >
              <th className="py-1 px-2 font-bold" style={{ color: headerTextColor }}>Phác đồ / Mô hình</th>
              <th className="py-1 px-1.5 text-center font-bold" style={{ color: headerTextColor }}>Liều dùng</th>
              <th className="py-1 px-1.5 text-center font-bold" style={{ color: headerTextColor }}>Thời gian</th>
              <th className="py-1 px-1.5 text-center font-bold" style={{ color: headerTextColor }}>Hiệu quả</th>
              <th className="py-1 px-2 text-right font-bold" style={{ color: headerTextColor }}>Tác dụng phụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/60" style={{ color: dataTextColor }}>
            <tr className={zebra ? 'bg-zinc-50/70' : ''}>
              <td className="py-1 px-2 font-medium" style={{ color: dataTextColor }}>Bismuth 4 thuốc</td>
              <td className="py-1 px-1.5 text-center">PPI + Bismuth + Tetra + Metron</td>
              <td className="py-1 px-1.5 text-center">14 ngày</td>
              <td className="py-1 px-1.5 text-center font-bold text-emerald-800">92.4%</td>
              <td className="py-1 px-2 text-right">Rối loạn tiêu hóa nhẹ</td>
            </tr>
            <tr className={zebra ? '' : 'bg-zinc-50/40'}>
              <td className="py-1 px-2 font-medium" style={{ color: dataTextColor }}>P-CAB Vonoprazan</td>
              <td className="py-1 px-1.5 text-center">Vonoprazan 20mg + Amoxicillin</td>
              <td className="py-1 px-1.5 text-center">14 ngày</td>
              <td className="py-1 px-1.5 text-center font-bold text-emerald-800">94.8%</td>
              <td className="py-1 px-2 text-right">Dung nạp tốt</td>
            </tr>
          </tbody>
        </table>
      </div>
      {sp.tableFootnote && (
        <div
          className="mt-1 italic font-serif"
          style={{
            fontSize: `${noteFontSize}pt`,
            color: noteTextColor,
          }}
        >
          {sp.tableFootnote}
        </div>
      )}
      {!captionAbove && <div className="mt-1">{captionEl}</div>}
    </div>
  );
};

export const EquationBoxRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const eq =
    element.specialProps?.equationLatex ||
    '\\mathcal{H}_{score} = \\alpha \\cdot \\text{HpSA} + \\beta \\cdot \\text{NSAID} - \\gamma \\cdot \\text{Age}';
  const num = element.specialProps?.equationNumber || '(1)';

  return (
    <div style={containerStyle} className="my-2 select-none">
      <div className="flex items-center justify-between py-1 px-2 bg-slate-50/60 rounded-md border border-slate-200/60 font-serif">
        <div className="flex-1 text-center font-mono text-[8pt] text-slate-800 italic">
          {eq}
        </div>
        <div className="text-[7.5pt] font-sans font-bold text-slate-600 pl-2">
          {num}
        </div>
      </div>
    </div>
  );
};

export const CodeAlgorithmRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const title =
    element.specialProps?.algorithmTitle ||
    'Thuật toán 1: Phân tầng nguy cơ xuất huyết tiêu hóa do thuốc ở người cao tuổi';

  return (
    <div style={containerStyle} className="my-2 select-none font-mono text-[6.8pt]">
      <div className="border-t-2 border-b-2 border-slate-900 py-1 space-y-1">
        <div className="font-bold text-[7.2pt] text-slate-900 pb-0.5 border-b border-slate-300">
          {title}
        </div>
        <div className="text-slate-600 italic">
          <strong>Đầu vào:</strong> Hồ sơ bệnh nhân P, Tiền sử NSAID N
        </div>
        <div className="text-slate-600 italic">
          <strong>Đầu ra:</strong> Chỉ định phối hợp PPI & Phác đồ tiệt trừ H. pylori
        </div>
        <div className="bg-slate-50 p-1.5 rounded space-y-0.5 border border-slate-200 text-slate-800 leading-tight">
          <div>1: <strong>if</strong> patient.age &gt;= 65 <strong>or</strong> patient.has_ulcer_history <strong>then</strong></div>
          <div className="pl-3">2: add_ppi_co_therapy(dose=&quot;standard&quot;)</div>
          <div className="pl-3">3: screen_helicobacter_pylori(method=&quot;HpSA&quot;)</div>
          <div>4: <strong>else</strong></div>
          <div className="pl-3">5: monitor_symptoms_routine()</div>
          <div>6: <strong>end if</strong></div>
        </div>
      </div>
    </div>
  );
};
