'use client';

import { useParams } from 'next/navigation';
import { TrashPreviewView } from '@/features/trash';

/** A paper in the trash, read-only, with the buttons to restore it or delete it for good. */
export default function TrashPreviewPage() {
  const params = useParams();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  return id ? <TrashPreviewView id={id} /> : null;
}
