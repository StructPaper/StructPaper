'use client';

import { useEffect, useState } from 'react';
import { http, isMockModeEnabled } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { batchActivity, type BatchActivity } from '@/lib/batch-import/activity';

export interface CompileActivity {
  /** What this tab is importing right now, if anything. */
  local: BatchActivity | null;
  /** My papers the server is compiling now / has waiting (also after a reload or from another tab). */
  server: { running: number; queued: number };
  active: boolean;
}

const IDLE: CompileActivity['server'] = { running: 0, queued: 0 };

/**
 * Tells whether papers of the signed-in user are still being imported or compiled. The server owns
 * the compile queue, so asking it keeps the answer true after the page is reloaded.
 */
export function useCompileActivity(pollMs = { busy: 2500, idle: 8000 }): CompileActivity {
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const [local, setLocal] = useState<BatchActivity | null>(() => batchActivity.get());
  const [server, setServer] = useState(IDLE);

  useEffect(() => batchActivity.subscribe(setLocal), []);

  useEffect(() => {
    if (!signedIn || isMockModeEnabled()) {
      setServer(IDLE);
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      let busy = false;
      try {
        const status: any = await http.get('/api/v1/compile/status', { skipGlobalToast: true } as any);
        const mine = status?.mine ?? IDLE;
        busy = mine.running + mine.queued > 0;
        if (!stopped) setServer({ running: mine.running ?? 0, queued: mine.queued ?? 0 });
      } catch {
        if (!stopped) setServer(IDLE);
      }
      if (!stopped) timer = setTimeout(poll, busy ? pollMs.busy : pollMs.idle);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  return { local, server, active: Boolean(local) || server.running + server.queued > 0 };
}
