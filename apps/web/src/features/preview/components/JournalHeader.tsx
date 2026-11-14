import React from 'react';
import { JournalHeaderProps } from './types';

export const JournalHeader: React.FC<JournalHeaderProps> = ({ paper }) => {
  const { metadata } = paper;

  return (
    <div className="mb-4">
      <div className="flex items-end justify-between leading-tight text-gray-900">
        <div>
          {/* Running Title - Exact LaTeX: \sffamily\itshape\bfseries\fontsize{8pt}{7pt}\selectfont */}
          <p
            className="font-bold italic text-[8.5pt] tracking-tight text-gray-900"
            style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
          >
            {metadata.journalName} {metadata.year}, {metadata.volume}({metadata.issue}):{metadata.firstPage}–{metadata.lastPage}
          </p>
          <div
            className="flex items-center gap-1.5 mt-0.5 text-[7.5pt] font-bold text-gray-500"
            style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
          >
            <svg className="w-3.5 h-3.5 inline-block text-[#F58220] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.686 2 6 4.686 6 8v3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1h-2V8c0-3.314-2.686-6-6-6zm0 2c2.209 0 4 1.791 4 4v3H8V8c0-2.209 1.791-4 4-4zm-4 9h8v7H8v-7z" />
            </svg>
            <span>Open Access Full Text Article</span>
          </div>
        </div>

        {/* Article Type - Exact LaTeX: \bfseries\fontsize{12pt}{12pt}\itshape\underline{...} */}
        <div className="text-right">
          <span
            className="font-bold italic text-[11pt] text-gray-900 underline underline-offset-2"
            style={{ fontFamily: "'Source Serif 4', 'Times New Roman', 'Palatino Linotype', Georgia, serif" }}
          >
            {metadata.articleType || 'Bài tổng quan'}
          </span>
        </div>
      </div>

      {/* Header Rule - Exact LaTeX \headrulewidth{.5pt} */}
      <div className="border-b border-black w-full mt-1.5" style={{ borderWidth: '0.6pt' }} />
    </div>
  );
};
