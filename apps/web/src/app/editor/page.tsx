'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function EditorRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  useEffect(() => {
    if (id) {
      router.replace(`/papers/${encodeURIComponent(id)}`);
    } else {
      router.replace('/papers');
    }
  }, [id, router]);

  return (
    <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex items-center justify-center bg-slate-900 text-white text-sm font-medium">
      Đang chuyển tiếp sang trình soạn thảo...
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex items-center justify-center bg-slate-900 text-white text-sm font-medium">
          Đang chuyển tiếp...
        </div>
      }
    >
      <EditorRedirect />
    </Suspense>
  );
}
