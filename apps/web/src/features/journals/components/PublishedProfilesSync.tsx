'use client';

import { useEffect } from 'react';
import { registerPublished, usePublishedProfiles } from '../hooks/usePublishedProfiles';

/** Mounted once at the root: keeps the profile resolver in step with what the server published. */
export function PublishedProfilesSync(): null {
  const { data } = usePublishedProfiles();
  useEffect(() => {
    registerPublished(data);
  }, [data]);
  return null;
}
