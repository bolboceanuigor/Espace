'use client';

import { useEffect } from 'react';
import { useBranding } from '@/context/BrandingContext';

export default function ThemeColorMeta() {
  const { branding } = useBranding();

  useEffect(() => {
    const existing = document.querySelector('meta[name="theme-color"]');
    if (existing) {
      existing.setAttribute('content', branding.primaryColor);
      return;
    }
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', branding.primaryColor);
    document.head.appendChild(meta);
  }, [branding.primaryColor]);

  return null;
}

