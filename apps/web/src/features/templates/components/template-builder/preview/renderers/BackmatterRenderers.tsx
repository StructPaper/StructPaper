'use client';

import React from 'react';
import { ElementRendererProps, buildContainerStyle } from './types';

export const AbbreviationsListRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const defaultAbbrs = [
    { term: 'ASA', definition: 'Acetylsalicylic acid' },
    { term: 'COX-1', definition: 'Cyclooxygenase-1' },
    { term: 'HpSA', definition: 'Helicobacter pylori stool antigen' },
    { term: 'ICU', definition: 'Intensive Care Unit (phòng chăm sóc tích cực)' },
    { term: 'MALT', definition: 'Mucosa-associated lymphoid tissue lymphoma' },
    { term: 'NSAID', definition: 'Non-steroidal anti-inflammatory drug' },
    { term: 'OLGA', definition: 'Operative Link on Gastritis Assessment' },
    { term: 'OLGIM', definition: 'Operative Link on Gastric Intestinal Metaplasia' },
    { term: 'PPI', definition: 'Proton pump inhibitor (Thuốc ức chế bơm Proton)' },
  ];
  const items =
    element.specialProps?.abbreviations && element.specialProps.abbreviations.length > 0
      ? element.specialProps.abbreviations
      : defaultAbbrs;

  return (
    <div style={containerStyle} className="space-y-1.5 font-sans">
      <div
        className="font-bold uppercase text-[9pt] tracking-wide mb-1"
        style={{ color: primaryColor }}
      >
        {element.specialProps?.customContentSample || 'DANH MỤC CÁC TỪ VIẾT TẮT'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[7.2pt] leading-tight text-slate-800">
        {items.map((abbr, i) => (
          <div key={i} className="flex items-baseline gap-1 py-0.5 border-b border-slate-100">
            <span className="font-bold font-mono text-[7.5pt]" style={{ color: primaryColor }}>
              {abbr.term}:
            </span>
            <span className="text-slate-700 truncate">{abbr.definition}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ConflictOfInterestRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle} className="font-sans space-y-1">
      <div
        className="font-bold uppercase text-[9pt] tracking-wide"
        style={{ color: primaryColor }}
      >
        XUNG ĐỘT LỢI ÍCH
      </div>
      <div className="text-[7.6pt] text-slate-800 leading-snug">
        {element.specialProps?.conflictText ||
          element.specialProps?.customContentSample ||
          'Tác giả cam kết không có mâu thuẫn quyền lợi và không có xung đột lợi ích liên quan đến bài nghiên cứu này.'}
      </div>
    </div>
  );
};

export const AuthorContributionRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const defaultContribs = [
    { author: 'Hà Vũ', role: 'lên ý tưởng, viết và chỉnh sửa bản thảo bài báo' },
    { author: 'Viên Vinh Phú', role: 'tham gia viết và chỉnh sửa bản thảo bài báo' },
  ];
  const contribs =
    element.specialProps?.contributions && element.specialProps.contributions.length > 0
      ? element.specialProps.contributions
      : defaultContribs;

  return (
    <div style={containerStyle} className="font-sans space-y-1">
      <div
        className="font-bold uppercase text-[9pt] tracking-wide"
        style={{ color: primaryColor }}
      >
        ĐÓNG GÓP CỦA CÁC TÁC GIẢ
      </div>
      <div className="space-y-0.5 text-[7.6pt] text-slate-800 leading-snug">
        {contribs.map((c, i) => (
          <div key={i}>
            <span className="font-bold">Tác giả {c.author}:</span> {c.role}
          </div>
        ))}
      </div>
    </div>
  );
};

export const AcknowledgementBoxRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div
      style={containerStyle}
      className="font-sans space-y-1 bg-slate-50/70 p-2 rounded border border-slate-200/70"
    >
      <div className="font-bold uppercase text-[8.5pt]" style={{ color: primaryColor }}>
        LỜI CẢM ƠN & NGUỒN TÀI TRỢ
      </div>
      <div className="text-[7.6pt] text-slate-700 leading-snug">
        {element.specialProps?.acknowledgementText ||
          element.specialProps?.customContentSample ||
          'Nghiên cứu này được tài trợ bởi Đại học Quốc gia Thành phố Hồ Chí Minh (ĐHQG-HCM) trong khuôn khổ Đề tài mã số VNUHCM-2025-MED-01.'}
      </div>
    </div>
  );
};

export const ReferencesBlockRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
  floatingRules,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const citeRules = floatingRules?.citation;
  const isApa = citeRules?.citationStyle === 'apa' || citeRules?.citationStyle === 'harvard';
  const isSuper = citeRules?.inTextFormat === 'superscript';
  const showDoi = citeRules?.showDoiInBibliography ?? true;
  const hangingPx = (citeRules?.hangingIndent ?? 5) * 2;

  const refLabelWeight = citeRules?.refLabelWeight === 'normal' ? 400 : 700;
  const refLabelColor = citeRules?.refLabelColor || primaryColor || '#0F172A';
  const refTextColor = citeRules?.refTextColor || element.styling.textColor;
  const doiColor = citeRules?.doiColor || primaryColor || '#2563EB';
  const doiUnderline = citeRules?.doiUnderline ? 'underline' : 'no-underline';

  if (element.specialProps?.referenceItems && element.specialProps.referenceItems.length > 0) {
    return (
      <div style={containerStyle}>
        <div
          className="font-bold uppercase text-[9.5pt] mb-1.5 font-sans"
          style={{ color: primaryColor }}
        >
          {element.specialProps?.referenceHeadingText || 'TÀI LIỆU THAM KHẢO'}
        </div>
        <div className="space-y-1">
          {element.specialProps.referenceItems.map((ref, idx) => (
            <div
              key={idx}
              className="flex items-start gap-1 text-[7.4pt] leading-[1.22] mb-1 text-left font-sans text-slate-800"
            >
              <span
                style={{ color: primaryColor }}
                className="font-bold flex-shrink-0 font-sans w-4 text-right"
              >
                {ref.num}.
              </span>
              <div className="flex-1">
                <span>{ref.text} </span>
                {ref.url && (
                  <span
                    style={{ color: primaryColor }}
                    className="underline break-all font-sans font-semibold"
                  >
                    {ref.url}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div className="font-bold uppercase text-[9pt] mb-2" style={{ color: primaryColor }}>
        {element.specialProps?.referenceHeadingText || 'TÀI LIỆU THAM KHẢO'}
      </div>
      <div
        className="space-y-1.5"
        style={{
          fontFamily: citeRules?.fontFamily || element.styling.fontFamily || 'Times New Roman',
          fontSize: citeRules?.fontSize ? `${citeRules.fontSize}pt` : `${element.styling.fontSize}pt`,
          color: refTextColor,
        }}
      >
        <div style={{ paddingLeft: `${hangingPx}px`, textIndent: `-${hangingPx}px` }}>
          {isApa ? (
            <span>
              Nguyen, H. N., & Tran, M. T. (2025). Automated Academic Typesetting from DOCX Documents. <em>Sci. Tech. Dev. J.</em>, 28(2), 112–124.
            </span>
          ) : (
            <span>
              <span style={{ fontWeight: refLabelWeight, color: refLabelColor }}>
                {isSuper ? '1. ' : '[1] '}
              </span>
              Nguyen, H. N., & Tran, M. T., &ldquo;Automated Academic Typesetting from DOCX Documents,&rdquo; <em>Sci. Tech. Dev. J.</em>, vol. 28, no. 2, pp. 112–124, 2025.
            </span>
          )}
          {showDoi && (
            <span
              className={`ml-1 font-mono text-[7pt] ${doiUnderline}`}
              style={{ color: doiColor }}
            >
              https://doi.org/10.32508/stdj.v28i2.1234
            </span>
          )}
        </div>

        <div style={{ paddingLeft: `${hangingPx}px`, textIndent: `-${hangingPx}px` }}>
          {isApa ? (
            <span>
              VNU-HCM Publishing House. (2024). <em>Guidelines for Scientific Paper Formatting and Citation Standards</em>. VNUHCM Press.
            </span>
          ) : (
            <span>
              <span style={{ fontWeight: refLabelWeight, color: refLabelColor }}>
                {isSuper ? '2. ' : '[2] '}
              </span>
              VNU-HCM Publishing House, <em>Guidelines for Scientific Paper Formatting and Citation Standards</em>, VNUHCM Press, 2024.
            </span>
          )}
          {showDoi && (
            <span
              className={`ml-1 font-mono text-[7pt] ${doiUnderline}`}
              style={{ color: doiColor }}
            >
              https://doi.org/10.32508/vnuhcm.guide.2024
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const BiographyBoxRenderer: React.FC<ElementRendererProps> = ({
  element,
  floatingRules,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const author = element.specialProps?.authorName || 'TS. Hà Vũ';
  const showPhoto =
    element.specialProps?.showAuthorPhoto ?? floatingRules?.biography?.showAuthorPhoto ?? true;
  const bio =
    element.specialProps?.bioText ||
    element.specialProps?.customContentSample ||
    'Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia TP.HCM. Hướng nghiên cứu chuyên sâu về bệnh lý tiêu hóa và quản lý dược lâm sàng ở bệnh nhân cao tuổi.';

  return (
    <div style={containerStyle} className="my-2 select-none flex items-start gap-2.5 font-sans">
      {showPhoto && (
        <div className="w-10 h-12 rounded-md bg-slate-200 border border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0 shadow-2xs">
          <span className="text-base">👤</span>
        </div>
      )}
      <div className="flex-1 text-[7pt] leading-snug">
        <span className="font-bold text-slate-900">{author}: </span>
        <span className="text-slate-700">{bio}</span>
      </div>
    </div>
  );
};
