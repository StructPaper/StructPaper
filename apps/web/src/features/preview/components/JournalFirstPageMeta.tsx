import React from 'react';
import { JournalSidebar } from './JournalSidebar';
import { JournalAbstractBox } from './JournalAbstractBox';
import { CompletePaper } from '@/lib/sample-papers';

interface JournalFirstPageMetaProps {
  paper: CompletePaper;
}

export const JournalFirstPageMeta: React.FC<JournalFirstPageMetaProps> = ({ paper }) => {
  const { metadata } = paper;

  return (
    <div className="mb-6">
      {/* Article Title - Exact LaTeX: \fontsize{18pt}{19pt}\selectfont\bfseries\color{titlecolor} */}
      <div className="mt-2 mb-2 max-w-[700px]">
        <h1
          className="font-bold text-[#2B74B7]"
          style={{
            fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif",
            fontSize: '18pt',
            lineHeight: '19pt',
            letterSpacing: '-0.012em',
          }}
        >
          {metadata.title}
        </h1>
      </div>

      {/* Authors List with affiliations & corresponding author mark */}
      <div className="mb-4">
        <p
          className="font-bold text-[11pt] text-[#2B74B7]"
          style={{
            fontFamily: "Calibri, 'Myriad Pro', 'Segoe UI', Arial, sans-serif",
            fontSize: '11pt',
            lineHeight: '12pt',
          }}
        >
          {(() => {
            const hasMultipleAffs = metadata.affiliations && metadata.affiliations.length > 1;
            return metadata.authors.map((author, index) => {
              const affMark = hasMultipleAffs ? (author.affiliationIds?.join(',') || '') : '';
              const corrMark = author.isCorresponding ? '*' : '';
              const supContent = `${affMark}${affMark && corrMark ? ',' : ''}${corrMark}`;
              const isLast = index === metadata.authors.length - 1;
              return (
                <span key={author.id || index}>
                  {author.name}
                  {supContent && <sup className="font-bold text-[#2B74B7]">{supContent}</sup>}
                  {!isLast && ', '}
                </span>
              );
            });
          })()}
        </p>
      </div>

      {/* 2-Panel Block: Left Sidebar (28%) + Right Abstract (72%) */}
      <div className="flex gap-4 items-start mb-4">
        <JournalSidebar paper={paper} />
        <JournalAbstractBox paper={paper} />
      </div>
    </div>
  );
};
