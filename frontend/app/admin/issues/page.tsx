'use client';

import { useEffect } from 'react';
import LoadingState from '@/components/common/LoadingState';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function LegacyAdminIssuesRedirectPage() {
  const localizedPath = useLocalizedPath();

  useEffect(() => {
    window.location.replace(localizedPath('/admin/requests'));
  }, [localizedPath]);

  return <LoadingState label="Se deschid cererile reale..." />;
}
