'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { communicationsApi } from '@/lib/api';
import { AnnouncementForm } from '../../AnnouncementForm';

export default function EditAdminAnnouncementPage() {
  const params = useParams<{ id: string }>();
  const [announcement, setAnnouncement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await communicationsApi.getAdminAnnouncement(params.id);
      setAnnouncement(response.data?.announcement || null);
    } catch (err: any) {
      setError(String(err?.message || 'Nu am putut încărca anunțul.'));
      setAnnouncement(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Se încarcă anunțul..." />;
  if (error) return <EmptyState title="Anunțul nu a fost găsit" description={error} />;
  if (!announcement) return <EmptyState title="Anunțul nu a fost găsit" description="Reveniți la lista de anunțuri." />;

  return <AnnouncementForm mode="edit" initial={announcement} />;
}
