'use client';

import React from 'react';
import { ElementRendererProps, buildContainerStyle, renderTextWithCitations } from './types';

export const HeadingRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const lvl = element.specialProps?.headingLevel || 1;
  const numScheme = element.specialProps?.headingNumbering || 'ROMAN';

  const getPrefix = () => {
    if (numScheme === 'NONE') return '';
    if (numScheme === 'ROMAN') return lvl === 1 ? 'I. ' : lvl === 2 ? 'II.A ' : 'III.A.1 ';
    if (numScheme === 'ARABIC') return lvl === 1 ? '1. ' : lvl === 2 ? '1.1 ' : '1.1.1 ';
    return '1. ';
  };

  const text =
    element.specialProps?.customContentSample ||
    'GIỚI THIỆU VỀ BỆNH LOÉT DẠ DÀY TÁ TRÀNG:';

  return (
    <div style={containerStyle}>
      <div
        className={`${
          lvl === 1
            ? 'text-[11pt] font-extrabold uppercase tracking-tight'
            : lvl === 2
              ? 'text-[10pt] font-bold tracking-tight'
              : 'text-[9.5pt] font-semibold italic'
        }`}
      >
        <span>{getPrefix()}</span>
        <span>{text}</span>
      </div>
    </div>
  );
};

export const BodyTextRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
  floatingRules,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};
  const dropCap = sp.dropCapEnabled ?? false;
  const rawText =
    sp.customContentSample ||
    'Loét dạ dày tá tràng là tình trạng tổn thương niêm mạc qua lớp cơ niêm, thường xảy ra ở vùng môn vị hoặc tá tràng dưới tác động của acid dạ dày và men pepsin. Quá trình lão hóa gây ra những thay đổi sâu sắc như lão hóa miễn dịch, rối loạn vi tuần hoàn và tình trạng teo niêm mạc dẫn đến giảm tiết acid.';

  const isContinuation = sp.isContinuation;
  const firstLetter = rawText.charAt(0);
  const restText = rawText.slice(1);

  return (
    <div style={containerStyle} className="leading-relaxed">
      {dropCap && !isContinuation ? (
        <div className="text-justify">
          <span
            className="float-left text-3xl font-bold font-serif leading-none pr-1.5 pt-0.5 select-none"
            style={{ color: primaryColor }}
          >
            {firstLetter}
          </span>
          <span>{renderTextWithCitations(restText, floatingRules?.citation, primaryColor)}</span>
        </div>
      ) : (
        <div
          className="text-justify"
          style={{ textIndent: `${sp.firstLineIndent || 4}mm` }}
        >
          {renderTextWithCitations(rawText, floatingRules?.citation, primaryColor)}
        </div>
      )}
    </div>
  );
};

export const CalloutBoxRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle}>
      <div
        className="font-bold mb-1 flex items-center gap-1 text-[9pt]"
        style={{ color: element.styling.borderColor }}
      >
        <span>{element.specialProps?.calloutTitle || '⚡ Điểm nhấn nghiên cứu'}</span>
      </div>
      <div className="whitespace-pre-wrap text-[8.5pt] leading-snug">
        {element.specialProps?.customContentSample ||
          'Nội dung điểm nhấn nghiên cứu mang tính đột phá và lưu ý thực hành lâm sàng.'}
      </div>
    </div>
  );
};
