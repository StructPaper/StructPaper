'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { forceUnlockBodyScroll } from '@/components/modals/ModalPortal';

/** On every route change make sure an unmounted modal can never leave the page scroll-locked. */
export function RouteScrollUnlock(): null {
  const pathname = usePathname();

  useEffect(() => {
    forceUnlockBodyScroll();
  }, [pathname]);

  return null;
}
