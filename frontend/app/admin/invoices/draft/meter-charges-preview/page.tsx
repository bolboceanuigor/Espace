'use client';

import { useEffect } from 'react';
import LoadingState from '@/components/common/LoadingState';
import { useLocalizedPath } from '@/lib/use-localized-path';

export default function LegacyMeterChargesPreviewRedirectPage() {
  const localizedPath = useLocalizedPath();

  useEffect(() => {
    window.location.replace(localizedPath(`/admin/tariffs/meter-charges-preview${window.location.search || ''}`));
  }, [localizedPath]);

  return <LoadingState label="Se deschide previzualizarea tarifelor..." />;
}
