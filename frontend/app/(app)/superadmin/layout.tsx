'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SuperadminSegmentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Temporary debug log requested for route load confirmation.
    console.log('route loaded', pathname);
  }, [pathname]);

  return <>{children}</>;
}
