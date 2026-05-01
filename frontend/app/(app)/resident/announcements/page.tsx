'use client';

import { useCallback } from 'react';
import AvizierPage, { AvizierAnnouncement } from '@/components/announcements/AvizierPage';
import { communicationsApi } from '@/lib/api';

export default function ResidentAnnouncementsPage() {
  const loadAnnouncements = useCallback(async () => {
    const response = await communicationsApi.listResidentAnnouncements();
    return (response.data || []) as AvizierAnnouncement[];
  }, []);

  return (
    <AvizierPage
      description="Anunțurile importante ale comunității tale, într-un format simplu și ușor de citit."
      loadAnnouncements={loadAnnouncements}
    />
  );
}
