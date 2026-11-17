import { ALL_JOURNAL_IDS } from '@structpaper/journal-profiles';
import JournalDetailClient from './journal-detail-client';

export const dynamicParams = true;

export function generateStaticParams() {
  const baseIds = ['new', ...ALL_JOURNAL_IDS];
  const prefixedIds = ALL_JOURNAL_IDS.map((jid) => `vnuhcm-${jid}`);
  const prefixedUnderscore = ALL_JOURNAL_IDS.map((jid) => `vnuhcm_${jid}`);
  const legacyPlaceholders = [
    'vnuhcm-natsci',
    'vnuhcm-tech',
    'vnuhcm-socsci',
    'vnuhcm-econ',
    'vnuhcm-med',
    'vnuhcm-earth',
    'vnuhcm-ns',
    'ns',
  ];

  const allIds = Array.from(
    new Set([...baseIds, ...prefixedIds, ...prefixedUnderscore, ...legacyPlaceholders])
  );

  return allIds.map((id) => ({ id }));
}

export default function JournalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <JournalDetailClient id={params.id} />;
}

