'use client';

import React from 'react';
import { ElementRendererProps, buildContainerStyle, renderTextWithCitations } from './types';

export const ArticleHeaderBadgeRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const type = element.specialProps?.articleType || 'Bài tổng quan';
  const isOpenAccess = element.specialProps?.isOpenAccess ?? true;
  const oaText = element.specialProps?.openAccessText || 'Open Access Full Text Article';

  return (
    <div
      style={containerStyle}
      className="flex items-center justify-between font-sans border-b border-slate-200 pb-1 mb-2"
    >
      {isOpenAccess && (
        <div className="flex items-center gap-1.5 text-[7.5pt] font-semibold text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E65100] flex items-center justify-center text-white text-[6pt] font-black">
            🔓
          </span>
          <span>{oaText}</span>
        </div>
      )}
      <div
        className="text-[9pt] font-bold italic underline"
        style={{ color: primaryColor }}
      >
        {type}
      </div>
    </div>
  );
};

export const ArticleTitleRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle}>
      <h1 className="leading-tight">
        {element.specialProps?.customContentSample ||
          'Nghiên cứu ứng dụng bóc tách cấu trúc OpenXML và tự động dàn trang báo cáo khoa học chuẩn VNUHCM'}
      </h1>
      {element.specialProps?.supportBilingual && (
        <div
          className="mt-1.5 italic text-slate-500 font-serif"
          style={{ fontSize: `${element.specialProps?.bilingualFontSize || 12}pt` }}
        >
          {element.specialProps?.bilingualLabel ||
            'Automated Academic Typesetting and Semantic OpenXML Extraction for VNUHCM Scientific Journals'}
        </div>
      )}
    </div>
  );
};

export const AuthorBlockRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle}>
      {element.specialProps?.customContentSample ? (
        <div className="font-semibold text-[11pt] text-[#2B74B7] leading-snug">
          {element.specialProps.customContentSample}
        </div>
      ) : (
        <div>
          <span className="font-semibold">Hà Vũ</span>
          <sup className="text-emerald-700 font-bold ml-0.5">1*</sup>,{' '}
          <span className="font-semibold">Viên Vinh Phú</span>
          <sup className="text-emerald-700 font-bold ml-0.5">1</sup>
        </div>
      )}
      {element.specialProps?.showAffiliations && !element.specialProps?.customContentSample && (
        <div className="mt-1 text-[8pt] text-slate-500 font-sans space-y-0.5">
          <div>
            <sup>1</sup> Khoa Y, Đại học Quốc Gia TP.HCM
          </div>
          <div>
            <sup>*</sup> Tác giả liên hệ: ha.vu@vnuhcm.edu.vn
          </div>
        </div>
      )}
    </div>
  );
};

export const AffiliationListRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const affiliations = element.specialProps?.affiliations;

  return (
    <div style={containerStyle} className="font-serif italic text-slate-700 leading-snug">
      {affiliations && affiliations.length > 0 ? (
        <div className="space-y-0.5">
          {affiliations.map((aff) => (
            <div key={aff.id} className="flex items-start gap-1">
              {aff.index && (
                <sup className="font-bold font-sans text-slate-500 mr-0.5">{aff.index}</sup>
              )}
              <span>
                {[aff.department, aff.institution, aff.address].filter(Boolean).join(' – ')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {element.specialProps?.affiliationText ||
            element.specialProps?.customContentSample ||
            'Bộ môn Nội - Khoa Y – Trường Đại học Khoa học Sức khỏe - Đại học Quốc Gia Thành phố Hồ Chí Minh'}
        </div>
      )}
    </div>
  );
};

export const CitationStripRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const label = element.specialProps?.citationLabel || 'Trích dẫn bài báo này :';
  const text =
    element.specialProps?.citationText ||
    element.specialProps?.customContentSample ||
    'Vũ H, Phú V V. Tổng quan về loét dạ dày tá tràng ở người cao tuổi và cập nhật trong điều trị. Sci. Tech. Dev. J. - Health Sci. 2026; 7(2):804-816.';

  return (
    <div
      style={{
        ...containerStyle,
        backgroundColor: element.styling.backgroundColor || '#DBEAFE',
        paddingTop: `${element.styling.padding.top || 3}px`,
        paddingBottom: `${element.styling.padding.bottom || 3}px`,
        paddingLeft: `${element.styling.padding.left || 4}px`,
        paddingRight: `${element.styling.padding.right || 4}px`,
      }}
      className="rounded-sm font-sans flex items-center justify-between text-[7.2pt] leading-tight text-slate-900 border border-blue-200/80"
    >
      <div className="flex-1">
        <span className="font-bold mr-1 text-[#1E3A8A]">{label}</span>
        <span className="text-slate-800">{text}</span>
      </div>
    </div>
  );
};

export const MetadataGridRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};

  if (sp.metadataLayout === 'sidebar-academic') {
    const historyItems = [
      { label: 'Ngày nhận', value: sp.historyReceived || '14-06-2025' },
      { label: 'Ngày sửa đổi', value: sp.historyRevised || '10-02-2026' },
      { label: 'Ngày chấp nhận', value: sp.historyAccepted || '14-04-2026' },
      { label: 'Ngày đăng', value: sp.historyPublished || '07-05-2026' },
    ];

    return (
      <div style={containerStyle} className="space-y-1.5 font-sans text-[6.8pt] leading-tight">
        {sp.affiliationText && (
          <div className="font-serif italic text-[7pt] text-slate-700 leading-snug border-b border-slate-200 pb-1 mb-1">
            {sp.affiliationText}
          </div>
        )}

        {/* Correspondence */}
        <div>
          <div style={{ color: primaryColor }} className="font-bold text-[6.8pt]">
            Liên hệ
          </div>
          <div className="text-slate-800 text-[6.3pt] leading-tight mt-0.5">
            <span className="font-bold">{sp.correspondenceAuthor || 'Hà Vũ'}</span>
            {sp.correspondenceAffiliation && `, ${sp.correspondenceAffiliation}`}
          </div>
          {sp.correspondenceEmail && (
            <div className="text-slate-600 text-[6pt] mt-0.5">
              Email: {sp.correspondenceEmail}.
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <div style={{ color: primaryColor }} className="font-bold text-[6.8pt] mb-0.5">
            Lịch sử
          </div>
          <div className="space-y-0.5 text-slate-700 text-[6.3pt]">
            {historyItems.map((h, i) => (
              <div key={i}>
                <span style={{ color: primaryColor }}>•</span> {h.label}: {h.value}
              </div>
            ))}
          </div>
        </div>

        {/* DOI */}
        {sp.doiUrl && (
          <div>
            <span style={{ color: primaryColor }} className="font-bold text-[6.8pt]">
              DOI :{' '}
            </span>
            <span className="font-bold text-slate-800 break-all text-[6.1pt]">
              {sp.doiUrl}
            </span>
          </div>
        )}

        {/* Copyright */}
        {sp.copyrightNotice && (
          <div>
            <div style={{ color: primaryColor }} className="font-bold text-[6.8pt]">
              Bản quyền
            </div>
            <p className="text-[5.6pt] text-slate-600 leading-tight mt-0.5">
              {sp.copyrightNotice}
            </p>
          </div>
        )}
      </div>
    );
  }

  const fields = (sp.metadataFields || []).filter((f) => f.visible);
  return (
    <div style={containerStyle} className="font-sans space-y-1.5">
      {fields.map((f) => (
        <div key={f.id} className="text-[7.5pt]">
          <span className="font-bold text-slate-700">{f.label}: </span>
          <span className="text-slate-600">{f.defaultValue}</span>
        </div>
      ))}
    </div>
  );
};

export const AbstractBoxRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
  floatingRules,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};

  return (
    <div style={containerStyle}>
      {!sp.isContinuation && (
        <div
          className="font-bold mb-1 font-sans"
          style={{ color: primaryColor, fontSize: `${element.styling.fontSize}pt` }}
        >
          {sp.abstractTitle || 'TÓM TẮT'}
        </div>
      )}
      <div className="whitespace-pre-wrap leading-relaxed text-justify">
        {renderTextWithCitations(
          sp.customContentSample ||
            'Bài báo này đề xuất một giải pháp trích xuất tự động cấu trúc văn bản học thuật từ định dạng OpenXML DOCX...',
          floatingRules?.citation,
          primaryColor
        )}
      </div>
      {sp.supportBilingual && !sp.isContinuation && (
        <div className="mt-3 pt-2 border-t border-slate-200/60">
          <div
            className="font-bold mb-1 font-sans"
            style={{ color: primaryColor, fontSize: `${element.styling.fontSize}pt` }}
          >
            ABSTRACT
          </div>
          <div className="italic font-serif leading-relaxed text-justify text-slate-600">
            {sp.bilingualLabel ||
              'This paper proposes an automated extraction framework for scientific papers from OpenXML DOCX format...'}
          </div>
        </div>
      )}
    </div>
  );
};

export const KeywordsGroupRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const keywords: string[] = element.specialProps?.keywords || [
    'Bệnh loét dạ dày tá tràng',
    'bệnh nhân cao tuổi',
    'Helicobacter pylori',
    'thuốc chống viêm không steroid',
    'thuốc ức chế bơm proton',
  ];

  return (
    <div style={containerStyle} className="flex flex-wrap items-center gap-1.5 leading-normal">
      <span className="font-bold font-sans mr-1" style={{ color: primaryColor }}>
        Từ khoá:
      </span>
      {keywords.map((kw, i) => (
        <span key={i} className="text-slate-700">
          {kw}
          {i < keywords.length - 1 && '; '}
        </span>
      ))}
    </div>
  );
};
