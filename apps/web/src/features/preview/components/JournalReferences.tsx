import React from 'react';
import { PaperReference } from '@/types/paper';

interface JournalReferencesProps {
  references: PaperReference[];
}

export const JournalReferences: React.FC<JournalReferencesProps> = ({ references }) => {
  if (!references || references.length === 0) return null;

  return (
    <div className="break-inside-avoid mt-8 pt-4 border-t border-gray-300">
      <div className="mb-2.5">
        <h2
          className="font-bold text-[12pt] uppercase tracking-normal text-[#2B74B7]"
          style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
        >
          TÀI LIỆU THAM KHẢO
        </h2>
      </div>

      {/* 2-Column Vancouver References - Exact LaTeX: \sffamily\fontsize{7}{8}\selectfont */}
      <div className="columns-1 md:columns-2 gap-6 text-[7pt] leading-[1.28] text-justify text-gray-800">
        {references.map((ref) => (
          <div key={ref.id} className="mb-1.5 pl-3.5 -indent-3.5 break-inside-avoid">
            <strong
              className="text-[#2B74B7] font-bold"
              style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
            >
              {ref.id}.{' '}
            </strong>
            <span style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}>
              {ref.raw}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
