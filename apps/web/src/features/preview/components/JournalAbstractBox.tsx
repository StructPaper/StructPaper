import React from 'react';
import { JournalAbstractBoxProps } from './types';

export const JournalAbstractBox: React.FC<JournalAbstractBoxProps> = ({ paper }) => {
  const { metadata } = paper;

  return (
    <div
      className="w-[72%] bg-[#E7ECF7] p-3.5 text-black"
      style={{ borderRadius: '1px' }}
    >
      <h3
        className="font-bold text-[9pt] text-[#2B74B7] uppercase mb-1.5 tracking-wide"
        style={{
          fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif",
          fontSize: '9pt',
          lineHeight: '10pt',
          fontWeight: 700,
        }}
      >
        TÓM TẮT
      </h3>
      <p
        className="text-justify text-[9.5pt] text-black"
        style={{
          fontFamily: "'Calibri Light', Calibri, 'Segoe UI', Arial, sans-serif",
          fontSize: '9.5pt',
          lineHeight: '1.18',
          fontWeight: 400,
        }}
      >
        {metadata.abstract}
      </p>

      {/* Keywords - Exact LaTeX: \prolight\textbf{Từ khoá: } */}
      {metadata.keywords && metadata.keywords.length > 0 && (
        <div className="mt-2 pt-0.5">
          <p
            className="text-[9.5pt] text-black"
            style={{
              fontFamily: "'Calibri Light', Calibri, 'Segoe UI', Arial, sans-serif",
              fontSize: '9.5pt',
              lineHeight: '1.18',
            }}
          >
            <strong
              className="text-black font-bold"
              style={{ fontWeight: 700 }}
            >
              Từ khoá:
            </strong>{' '}
            {metadata.keywords.join(', ')}.
          </p>
        </div>
      )}

      {/* Optional English Abstract if provided */}
      {metadata.abstractEn && (
        <div className="mt-3 pt-2 border-t border-[#CBD8EF]/60">
          <h4
            className="font-bold text-[9pt] text-[#2B74B7] uppercase mb-1 tracking-wide"
            style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
          >
            ABSTRACT
          </h4>
          <p
            className="text-justify leading-[1.38] text-[9pt] text-gray-800 italic font-light"
            style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif", fontWeight: 300 }}
          >
            {metadata.abstractEn}
          </p>
          {metadata.keywordsEn && metadata.keywordsEn.length > 0 && (
            <p
              className="mt-1.5 text-[8.5pt] text-gray-700 font-light"
              style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif", fontWeight: 300 }}
            >
              <strong
                className="text-[#2B74B7] font-bold not-italic"
                style={{ fontWeight: 700 }}
              >
                Keywords:
              </strong>{' '}
              {metadata.keywordsEn.join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
