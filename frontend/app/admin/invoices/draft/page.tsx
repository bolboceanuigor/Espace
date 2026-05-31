'use client';

import { useEffect } from 'react';
import LoadingState from '@/components/common/LoadingState';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function LegacyInvoiceDraftRedirectPage() {
  const localizedPath = useLocalizedPath();

  useEffect(() => {
    window.location.replace(localizedPath('/admin/billing-drafts'));
  }, [localizedPath]);

  return <LoadingState label="Se deschide fluxul nou de drafturi..." />;
}
