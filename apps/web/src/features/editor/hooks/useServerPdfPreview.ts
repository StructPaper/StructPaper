import { useEffect, useState } from 'react';
import { fetchPdfPreview } from '@/lib/editor/pdf-preview-sync';

export type ServerPreview =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'missing'; url: null };

/** The PDF the server keeps for a paper (what a reader sees instead of compiling it). */
export function useServerPdfPreview(paperId: string): ServerPreview {
  const [state, setState] = useState<ServerPreview>({ status: 'loading', url: null });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading', url: null });
    fetchPdfPreview(paperId).then((blob) => {
      if (cancelled) return;
      if (!blob) return setState({ status: 'missing', url: null });
      objectUrl = URL.createObjectURL(blob);
      setState({ status: 'ready', url: objectUrl });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paperId]);

  return state;
}
