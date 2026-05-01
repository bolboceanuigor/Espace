'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminStructureApi, issuesApi } from '@/lib/api';
import MobilePageHeader from '@/components/common/MobilePageHeader';
import { useToast } from '@/components/ui/ToastProvider';

export default function ResidentIssueCreatePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [apartments, setApartments] = useState<any[]>([]);
  const [loadingApartments, setLoadingApartments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    apartmentId: '',
    buildingId: '',
    staircaseId: '',
    title: '',
    description: '',
    category: 'OTHER' as 'WATER' | 'ELECTRICITY' | 'ELEVATOR' | 'CLEANING' | 'HEATING' | 'SECURITY' | 'OTHER',
    locationType: 'APARTMENT' as 'APARTMENT' | 'BUILDING' | 'STAIRCASE' | 'COMMON_AREA',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    fileUrl: '',
    fileName: '',
    fileType: '',
  });

  useEffect(() => {
    setLoadingApartments(true);
    adminStructureApi
      .listApartments()
      .then((res) => setApartments(res.data || []))
      .catch(() => {
        setApartments([]);
        showToast('Nu am putut încărca apartamentele.', 'error');
      })
      .finally(() => setLoadingApartments(false));
  }, []);

  return (
    <div className="space-y-4 overflow-x-hidden pb-24 md:pb-4">
      <MobilePageHeader title="Sesizare nouă" subtitle="Descrie problema pentru administrare." showBackButton />
      <div className="rounded-xl border border-border/70 bg-card p-4">
        {loadingApartments ? <p className="mb-2 text-xs text-muted-foreground">Se încarcă apartamentele...</p> : null}
        {!loadingApartments && !apartments.length ? (
          <p className="mb-2 text-xs text-muted-foreground">Nu există apartamente disponibile pentru raportare momentan.</p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input className="input" placeholder="Titlu" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <select className="select" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as any }))}>
            {['WATER', 'ELECTRICITY', 'ELEVATOR', 'CLEANING', 'HEATING', 'SECURITY', 'OTHER'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select className="select" value={form.locationType} onChange={(e) => setForm((p) => ({ ...p, locationType: e.target.value as any }))}>
            {['APARTMENT', 'BUILDING', 'STAIRCASE', 'COMMON_AREA'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select className="select" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as any }))}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          {form.locationType === 'APARTMENT' ? (
            <select className="select md:col-span-2" value={form.apartmentId} onChange={(e) => setForm((p) => ({ ...p, apartmentId: e.target.value }))}>
              <option value="">Selecteaza apartamentul</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.building?.name} / {apartment.staircase?.name} / #{apartment.number}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <textarea className="input mt-2 min-h-[140px]" placeholder="Descriere" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input className="input" placeholder="Attachment URL" value={form.fileUrl} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} />
          <input className="input" placeholder="Attachment name" value={form.fileName} onChange={(e) => setForm((p) => ({ ...p, fileName: e.target.value }))} />
          <input className="input" placeholder="Attachment type (image/jpeg)" value={form.fileType} onChange={(e) => setForm((p) => ({ ...p, fileType: e.target.value }))} />
        </div>
        <button
          className="mt-3 min-h-11 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={submitting}
          onClick={async () => {
            if (!form.title.trim() || !form.description.trim()) {
              showToast('Completează titlul și descrierea.', 'error');
              return;
            }
            try {
              setSubmitting(true);
              const created = await issuesApi.residentCreate({
                apartmentId: form.apartmentId || undefined,
                buildingId: form.buildingId || undefined,
                staircaseId: form.staircaseId || undefined,
                title: form.title,
                description: form.description,
                category: form.category,
                locationType: form.locationType,
                priority: form.priority,
              });
              if (form.fileUrl && form.fileName && form.fileType) {
                await issuesApi.residentAddAttachment(created.data.id, {
                  fileUrl: form.fileUrl,
                  fileName: form.fileName,
                  fileType: form.fileType,
                });
              }
              showToast('Sesizarea a fost trimisă.');
              router.push(`/resident/issues/${created.data.id}`);
            } catch {
              showToast('Nu am putut trimite sesizarea.', 'error');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? 'Se trimite...' : 'Trimite sesizare'}
        </button>
      </div>
    </div>
  );
}
