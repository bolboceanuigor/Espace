'use client';

import { useEffect } from 'react';
import LoadingState from '@/components/common/LoadingState';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function LegacyFinalizeRedirectPage() {
  const localizedPath = useLocalizedPath();

  useEffect(() => {
    window.location.replace(localizedPath('/admin/billing-drafts?tab=invoices'));
  }, [localizedPath]);

  return <LoadingState label="Se deschide publicarea internă..." />;
}
