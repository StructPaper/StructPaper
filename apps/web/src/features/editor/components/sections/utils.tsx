import React from 'react';

export function generateStandardCitation(meta?: any): string {
  if (!meta) return '';
  const authorNames =
    meta.authors && meta.authors.length > 0
      ? meta.authors
          .map((a: any) => {
            const parts = (a.name || '').trim().split(/\s+/);
            const last = parts.pop() || '';
            const initials = parts.map((p: string) => p[0]?.toUpperCase()).join('');
            return initials ? `${last} ${initials}` : last;
          })
          .join(', ')
      : 'Tác giả bài báo';
  const title = meta.title || 'Tiêu đề bài báo';
  const journal = meta.journalName || meta.journalAbbv || 'Tạp chí ĐHQG-HCM';
  const year = meta.year || '2024';
  const vol = meta.volume || '1';
  const issue = meta.issue ? `(${meta.issue})` : '';
  const pages = meta.firstPage ? `:${meta.firstPage}-${meta.lastPage || meta.firstPage}` : '';
  const doi = meta.doi ? ` https://doi.org/${meta.doi.replace('https://doi.org/', '')}` : '';
  return `${authorNames}. ${title}. ${journal}. ${year}; ${vol}${issue}${pages}.${doi}`;
}

export function parsePastedTableText(
  text: string
): { headers: string[]; rows: string[][] } | null {
  const rawLines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return null;

  // Detect Markdown table
  if (rawLines[0].includes('|')) {
    const cleanLines = rawLines.filter((l) => !/^\|?[\s-:]+\|?$/.test(l));
    const parsed = cleanLines.map((l) =>
      l
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim())
    );
    if (parsed.length > 0) {
      return {
        headers: parsed[0],
        rows: parsed.slice(1).length > 0 ? parsed.slice(1) : [Array(parsed[0].length).fill('')],
      };
    }
  }

  // Detect delimiter
  const sample = rawLines[0];
  let delimiter = '\t';
  if (sample.includes('\t')) {
    delimiter = '\t';
  } else if (sample.includes(',') && !sample.includes('\t')) {
    delimiter = ',';
  } else if (sample.includes(';') && !sample.includes('\t')) {
    delimiter = ';';
  }

  const parsed = rawLines.map((l) => l.split(delimiter).map((c) => c.trim()));
  const maxCols = Math.max(...parsed.map((r) => r.length));
  const normalized = parsed.map((r) => {
    while (r.length < maxCols) r.push('');
    return r;
  });

  if (normalized.length === 1) {
    return {
      headers: normalized[0],
      rows: [Array(maxCols).fill('')],
    };
  }

  return {
    headers: normalized[0],
    rows: normalized.slice(1),
  };
}

export function renderColoredParagraphCitations(
  text: string,
  onStartEdit: () => void
): React.ReactNode {
  if (!text) {
    return (
      <span className="text-zinc-400 italic">
        Nhấp để nhập nội dung đoạn văn bản...
      </span>
    );
  }

  const regex = /\[([0-9\s,\-–—]+|[A-Za-zÀ-ỹ\s,.\d]+)\]/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const fullMatch = match[0];

    if (matchStart > lastIndex) {
      elements.push(text.slice(lastIndex, matchStart));
    }

    elements.push(
      <span
        key={`cite_${matchStart}_${matchEnd}`}
        className="text-blue-600 font-semibold cursor-pointer hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
      >
        {fullMatch}
      </span>
    );

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

export function renderColoredTextCitations(text: string): React.ReactNode {
  if (!text) return null;
  const regex = /\[([0-9\s,\-–—]+|[A-Za-zÀ-ỹ\s,.\d]+)\]/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const fullMatch = match[0];

    if (matchStart > lastIndex) {
      elements.push(text.slice(lastIndex, matchStart));
    }

    elements.push(
      <span
        key={`cite_ro_${matchStart}_${matchEnd}`}
        className="text-blue-600 font-bold"
      >
        {fullMatch}
      </span>
    );

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

