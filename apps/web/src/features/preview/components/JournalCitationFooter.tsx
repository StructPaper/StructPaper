import React from 'react';
import { PaperMetadata } from '@/types/paper';

interface JournalCitationFooterProps {
  metadata: PaperMetadata;
}

export const JournalCitationFooter: React.FC<JournalCitationFooterProps> = ({ metadata }) => {
  const authorNames = metadata.authors.map((a) => a.name.split(' ').pop()).join(' ');

  return (
    <div
      className="mt-8 pt-3 border-t border-gray-200"
      style={{ fontFamily: "'Source Sans 3', Arial, sans-serif" }}
    >
      <div
        className="bg-[#DAE7F5] p-2 text-gray-900 leading-tight flex items-center justify-between gap-3 shadow-2xs"
        style={{ borderRadius: '1px' }}
      >
        <p className="text-[8pt] text-gray-900 leading-snug">
          <strong className="text-[#2B74B7]">Trích dẫn bài báo này: </strong>
          <strong>{authorNames}. {metadata.title}. </strong>
          <span className="italic">{metadata.journalName || 'Sci. Tech. Dev. J. – Health Sci.'}</span>{' '}
          {metadata.year}; {metadata.volume}({metadata.issue}):{metadata.firstPage}–{metadata.lastPage}.
        </p>

        <span className="font-extrabold text-[#2B74B7] text-[10pt] flex-shrink-0">
          {metadata.firstPage || 1}
        </span>
      </div>
    </div>
  );
};
