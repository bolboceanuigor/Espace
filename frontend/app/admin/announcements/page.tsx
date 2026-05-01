'use client';

import { useCallback } from 'react';
import AvizierPage, { AvizierAnnouncement, AvizierCategory, AvizierPriority } from '@/components/announcements/AvizierPage';
import { communicationsApi } from '@/lib/api';

export default function AdminAnnouncementsPage() {
  const loadAnnouncements = useCallback(async () => {
    const response = await communicationsApi.listAdminAnnouncements();
    return (response.data || []) as AvizierAnnouncement[];
  }, []);

  const createAnnouncement = useCallback(
    async (data: { title: string; category: AvizierCategory; content: string; priority: AvizierPriority }) => {
      const response = await communicationsApi.createAdminAnnouncement({
        title: data.title,
        content: data.content,
        contentType: data.category,
        importance: data.priority,
        targetType: 'ORGANIZATION',
        commentsEnabled: true,
      });
      return response.data as AvizierAnnouncement;
    },
    [],
  );

  return (
    <AvizierPage
      description="Anunțuri oficiale pentru comunitate, cu priorități clare și informații ușor de urmărit."
      loadAnnouncements={loadAnnouncements}
      createAnnouncement={createAnnouncement}
      canPersistCreate
    />
  );
}
