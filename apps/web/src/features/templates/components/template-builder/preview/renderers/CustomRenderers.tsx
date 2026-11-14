'use client';

import React from 'react';
import { ElementRendererProps, buildContainerStyle } from './types';

export const LinkBoxRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};
  const label = sp.linkLabel || 'Mã định danh DOI';
  const url = sp.linkUrl || 'https://doi.org/10.32508/vnuhcmj-hs.v7i1.630';
  const showQr = sp.showQrCode ?? true;

  return (
    <div style={containerStyle} className="my-1.5 select-none font-sans">
      <div className="flex items-center justify-between p-2 rounded-xl border border-blue-200/80 bg-blue-50/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
            ↗
          </span>
          <div className="min-w-0">
            <div className="text-[7pt] font-bold text-slate-700 uppercase tracking-wider">
              {label}
            </div>
            <div className="text-[7pt] text-blue-600 font-mono truncate">{url}</div>
          </div>
        </div>
        {showQr && (
          <div
            className="shrink-0 flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-2xs"
            title="Mã QR bản in"
          >
            <svg className="w-5 h-5 text-slate-800" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm10 0h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export const DividerLineRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle} className="my-2 select-none">
      <hr className="border-t border-slate-300 w-full" />
    </div>
  );
};

export const CustomFieldRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle}>
      <div className="font-bold text-[8.5pt] text-slate-800 mb-0.5">{element.name}:</div>
      <div className="text-[8.5pt] text-slate-600 leading-snug">
        {element.specialProps?.customContentSample ||
          'Nội dung chi tiết được định nghĩa tùy ý.'}
      </div>
    </div>
  );
};

export const CustomBlockRenderer: React.FC<ElementRendererProps> = ({
  element,
  primaryColor,
}) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const content = element.specialProps?.customContentSample || '';
  const colonIdx = content.indexOf(': ');
  const isCitationStrip =
    element.id.includes('cite_strip') || content.toLowerCase().includes('trích dẫn');

  return (
    <div style={containerStyle} className="leading-snug select-text">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {colonIdx !== -1 && colonIdx < 30 ? (
            <span>
              <strong className="font-bold text-slate-900">{content.slice(0, colonIdx + 1)}</strong>
              <span> {content.slice(colonIdx + 2)}</span>
            </span>
          ) : (
            <span>{content || element.name}</span>
          )}
        </div>
      </div>
      {isCitationStrip && (
        <div className="flex justify-end pr-0.5 mt-0.5">
          <span style={{ color: primaryColor }} className="font-bold text-[9pt] font-sans">
            1
          </span>
        </div>
      )}
    </div>
  );
};

export const CustomCompositeRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const subItems = element.specialProps?.subItems || [];
  const layout = element.specialProps?.compositeLayout || 'stacked';

  if (layout === 'inline') {
    return (
      <div style={containerStyle} className="leading-relaxed">
        {subItems.map((item) => (
          <span
            key={item.id}
            style={{
              fontFamily: item.styling.fontFamily,
              fontSize: `${item.styling.fontSize || element.styling.fontSize}pt`,
              fontWeight:
                item.styling.fontWeight === 'bold'
                  ? 700
                  : item.styling.fontWeight === 'semibold'
                    ? 600
                    : 400,
              fontStyle: item.styling.fontStyle || 'normal',
              color: item.styling.textColor || element.styling.textColor,
              textTransform: item.styling.textTransform || 'none',
              marginRight: '4px',
            }}
          >
            {item.defaultValue}
            {item.kind === 'constant' && (item.styling.suffix || ' ')}
          </span>
        ))}
      </div>
    );
  }

  if (layout === 'split-cols') {
    return (
      <div style={containerStyle} className="grid grid-cols-[30%_1fr] gap-2 items-baseline">
        <div className="space-y-1 border-r border-slate-200/90 pr-2">
          {subItems
            .filter((i) => i.kind === 'constant')
            .map((item) => (
              <div
                key={item.id}
                style={{
                  fontFamily: item.styling.fontFamily,
                  fontSize: `${item.styling.fontSize || element.styling.fontSize}pt`,
                  fontWeight: item.styling.fontWeight === 'bold' ? 700 : 600,
                  color: item.styling.textColor || element.styling.textColor,
                  textTransform: item.styling.textTransform || 'none',
                }}
              >
                {item.defaultValue}
              </div>
            ))}
        </div>
        <div className="space-y-1 pl-1">
          {subItems
            .filter((i) => i.kind === 'variable')
            .map((item) => (
              <div
                key={item.id}
                style={{
                  fontFamily: item.styling.fontFamily,
                  fontSize: `${item.styling.fontSize || element.styling.fontSize}pt`,
                  fontWeight: 400,
                  color: item.styling.textColor || element.styling.textColor,
                }}
              >
                {item.defaultValue}
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="space-y-1">
      {subItems.map((item) => (
        <div
          key={item.id}
          style={{
            fontFamily: item.styling.fontFamily,
            fontSize: `${item.styling.fontSize || element.styling.fontSize}pt`,
            fontWeight:
              item.styling.fontWeight === 'bold'
                ? 700
                : item.styling.fontWeight === 'semibold'
                  ? 600
                  : 400,
            fontStyle: item.styling.fontStyle || 'normal',
            color: item.styling.textColor || element.styling.textColor,
            textTransform: item.styling.textTransform || 'none',
          }}
        >
          {item.defaultValue}
        </div>
      ))}
    </div>
  );
};

export const DefaultRenderer: React.FC<ElementRendererProps> = ({ element }) => {
  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  return (
    <div style={containerStyle}>
      <div className="text-xs font-semibold">{element.name}</div>
    </div>
  );
};
