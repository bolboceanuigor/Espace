'use client';

import { useEffect, useState } from 'react';
import FileList from '@/components/files/FileList';
import FileUploadField from '@/components/files/FileUploadField';
import { adminStructureApi, communicationsApi, filesApi } from '@/lib/api';

export default function AdminDocumentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [staircases, setStaircases] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [uploadedAsset, setUploadedAsset] = useState<any | null>(null);
  const [adminFiles, setAdminFiles] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    fileUrl: '',
    fileName: '',
    fileType: 'application/pdf',
    targetType: 'ORGANIZATION' as 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT',
    buildingId: '',
    staircaseId: '',
    apartmentId: '',
  });

  const load = async () => {
    const [docRes, bRes, aRes, filesRes] = await Promise.all([
      communicationsApi.listAdminDocuments(),
      adminStructureApi.listBuildings(),
      adminStructureApi.listApartments(),
      filesApi.adminList(),
    ]);
    setRows(docRes.data || []);
    setBuildings(bRes.data || []);
    setApartments(aRes.data || []);
    setAdminFiles(filesRes.data || []);
    const uniqueStaircases = new Map<string, any>();
    for (const apt of aRes.data || []) {
      if (apt.staircase?.id && !uniqueStaircases.has(apt.staircase.id)) {
        uniqueStaircases.set(apt.staircase.id, apt.staircase);
      }
    }
    setStaircases(Array.from(uniqueStaircases.values()));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Documents</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Upload document</p>
        <FileUploadField
          label="Upload document file"
          accept=".pdf,image/*"
          onUpload={async (file) => {
            const res = await filesApi.adminUpload(file, { entityType: 'DOCUMENT' });
            setUploadedAsset(res.data);
            setForm((p) => ({
              ...p,
              fileUrl: res.data.fileUrl,
              fileName: res.data.fileName,
              fileType: res.data.mimeType,
            }));
            const list = await filesApi.adminList();
            setAdminFiles(list.data || []);
          }}
        />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <input className="input" placeholder="File URL" value={form.fileUrl} readOnly />
          <input className="input" placeholder="File name" value={form.fileName} readOnly />
          <input className="input" placeholder="File type" value={form.fileType} readOnly />
          <select className="select" value={form.targetType} onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value as any }))}>
            <option value="ORGANIZATION">ORGANIZATION</option>
            <option value="BUILDING">BUILDING</option>
            <option value="STAIRCASE">STAIRCASE</option>
            <option value="APARTMENT">APARTMENT</option>
          </select>
          {form.targetType === 'BUILDING' ? (
            <select className="select" value={form.buildingId} onChange={(e) => setForm((p) => ({ ...p, buildingId: e.target.value }))}>
              <option value="">Select building</option>
              {buildings.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          ) : null}
          {form.targetType === 'STAIRCASE' ? (
            <select className="select" value={form.staircaseId} onChange={(e) => setForm((p) => ({ ...p, staircaseId: e.target.value }))}>
              <option value="">Select staircase</option>
              {staircases.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          ) : null}
          {form.targetType === 'APARTMENT' ? (
            <select className="select" value={form.apartmentId} onChange={(e) => setForm((p) => ({ ...p, apartmentId: e.target.value }))}>
              <option value="">Select apartment</option>
              {apartments.map((item) => (
                <option key={item.id} value={item.id}>{item.building?.name} / {item.staircase?.name} / #{item.number}</option>
              ))}
            </select>
          ) : null}
        </div>
        <textarea className="input mt-2 min-h-[90px]" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        <button
          className="mt-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          onClick={async () => {
            if (!uploadedAsset?.id) return;
            await communicationsApi.createAdminDocument({
              title: form.title,
              description: form.description || undefined,
              fileUrl: form.fileUrl,
              fileName: form.fileName,
              fileType: form.fileType,
              targetType: form.targetType,
              buildingId: form.buildingId || undefined,
              staircaseId: form.staircaseId || undefined,
              apartmentId: form.apartmentId || undefined,
            });
            setForm({
              title: '',
              description: '',
              fileUrl: '',
              fileName: '',
              fileType: 'application/pdf',
              targetType: 'ORGANIZATION',
              buildingId: '',
              staircaseId: '',
              apartmentId: '',
            });
            setUploadedAsset(null);
            await load();
          }}
        >
          Save document
        </button>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Uploaded files</p>
        <FileList
          files={adminFiles}
          onDelete={async (id) => {
            await filesApi.adminDelete(id);
            const list = await filesApi.adminList();
            setAdminFiles(list.data || []);
          }}
        />
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-6 gap-2 border-b border-border/60 pb-2 text-xs text-muted-foreground">
          <span>Title</span><span>Target</span><span>Type</span><span>Created</span><span>File</span><span>Actions</span>
        </div>
        <div className="space-y-2 pt-2">
          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-6 gap-2 rounded-lg border border-border/60 px-2 py-2 text-sm text-foreground">
              <span>{row.title}</span>
              <span>{row.targetType}</span>
              <span>{row.fileType}</span>
              <span>{new Date(row.createdAt).toLocaleDateString()}</span>
              <a href={row.fileAssetId ? filesApi.secureDownloadUrl(row.fileAssetId) : row.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                {row.fileName}
              </a>
              <span>
                <button className="text-rose-600" onClick={async () => { await communicationsApi.deleteAdminDocument(row.id); await load(); }}>
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
