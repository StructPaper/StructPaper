'use client';

import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import type { CompletePaper } from '@/types/paper';
import { labelsFor } from '@/lib/page-labels';
import { resolvePublication, hasPublicationValue } from '@/lib/publication';
import { DEFAULT_QR_URL, doiToUrl } from '@/lib/qr-latex';
import { getJournalTemplate } from '@/lib/templates';
import type { OverviewLang } from './overview-doc';
import type { PageMeta } from './overview-pages';

/** "VNUHCM Journal of Health Sciences 2026, 7(1):990-1011": the line printed at the top of every page. */
export function runningHeader(paper: CompletePaper): string {
  const m = paper.metadata;
  const pub = resolvePublication(m);
  const tmpl = getJournalTemplate(m.journalId);
  const name = tmpl.officialNameEn || m.journalName || '';
  const year = m.year || String(new Date().getFullYear());
  return `${name} ${year}, ${pub.volume}(${pub.issue}):${pub.firstPage}-${pub.lastPage}`.trim();
}

/** The QR code of the title block as an SVG (the article's DOI link, or the journal's own address). */
export function qrSvg(paper: CompletePaper): string {
  const url = doiToUrl(resolvePublication(paper.metadata).doi) ?? DEFAULT_QR_URL;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/** What the printing of the page needs besides the text. */
export function pageMeta(paper: CompletePaper, lang: OverviewLang, citeText: string, titleColor: string, position: PageMeta['numberPosition'], skipFirstNumber: boolean, showNumbers: boolean): PageMeta {
  const pub = resolvePublication(paper.metadata);
  const first = Number(pub.firstPage);
  return {
    header: runningHeader(paper),
    label: lang === 'en' ? 'Page' : 'Trang',
    cite: citeText,
    citeLabel: `${labelsFor(lang).citeText}: `,
    numberPosition: position,
    skipFirstNumber,
    showNumbers,
    titleColor,
    firstPage: Number.isFinite(first) && first > 0 ? first : 1,
  };
}

/**
 * The parts of the first page that are not the flow of text: the head (journal line, "Open Access", article type) and the column on
 * the left with the affiliations, correspondence, history, DOI and copyright. Placed where the sample PDFs have them (points).
 */
export const FirstPageChrome: React.FC<{ paper: CompletePaper; lang: OverviewLang; articleType: string }> = ({ paper, lang, articleType }) => {
  const L = labelsFor(lang);
  const m = paper.metadata;
  const pub = resolvePublication(m);
  const header = useMemo(() => runningHeader(paper), [paper]);
  const dates = m.dates ?? { received: '', revised: '', accepted: '', published: '' };
  const q = (v: string | undefined) => (hasPublicationValue(v) ? v : '?');
  const corresponding = m.corresponding;
  return (
    <div className="ov-chrome" aria-hidden contentEditable={false}>
      <div className="ov-p1-head">
        <span className="ov-p1-journal">{header}</span>
        <span className="ov-p1-oa">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ov-oa-icon" src="/demo-images/open-access.png" alt="" />
          Open Access Full Text Article
        </span>
        {articleType && <span className="ov-p1-type">{articleType}</span>}
      </div>
      <div className="ov-rail">
        <i className="ov-rail-rule" />
        {m.affiliations?.length ? (
          <div className="ov-rail-aff">
            {m.affiliations.map((a) => (
              <div key={a.id}>
                {m.affiliations.length > 1 && <sup>{a.id}</sup>}
                {lang === 'en' ? a.nameEn || a.name : a.name}
              </div>
            ))}
          </div>
        ) : null}
        <div className="ov-rail-label">{L.correspondence}</div>
        <div className="ov-rail-text">
          {corresponding?.name ? (
            <>
              <b>{corresponding.name}</b>
              {corresponding.affiliation ? `, ${corresponding.affiliation}` : ''}
            </>
          ) : (
            <span className="ov-muted">—</span>
          )}
          {corresponding?.email && <div className="ov-rail-email">Email: {corresponding.email}</div>}
        </div>
        <div className="ov-rail-label ov-rail-label-history">{L.history}</div>
        <ul className="ov-rail-history">
          <li>
            {L.received}: {q(dates.received)}
          </li>
          <li>
            {L.revised}: {q(dates.revised)}
          </li>
          <li>
            {L.accepted}: {q(dates.accepted)}
          </li>
          <li>
            {L.published}: {q(pub.published)}
          </li>
        </ul>
        <div className="ov-rail-doi">
          DOI : <b>{hasPublicationValue(pub.doi) ? (pub.doi.startsWith('http') ? pub.doi : `https://doi.org/${pub.doi}`) : '?'}</b>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ov-rail-check" src="/demo-images/check-update.jpeg" alt="" />
        <div className="ov-rail-label ov-rail-label-copy">{L.copyright}</div>
        <div className="ov-rail-copy">
          <span className="ov-copy-serif">© {L.publisherShort}. </span>
          {L.copyrightText}
        </div>
      </div>
    </div>
  );
};
