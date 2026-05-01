'use client';

import { useEffect, useState } from 'react';
import { releaseNotesApi } from '@/lib/api';

const TARGET_ROLES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'] as const;

export default function SuperadminReleaseNotesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({ title: '', content: '', version: '', targetRole: 'ALL' as (typeof TARGET_ROLES)[number] });
  const [form, setForm] = useState({
    title: '',
    content: '',
    version: '',
    targetRole: 'ALL' as (typeof TARGET_ROLES)[number],
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await releaseNotesApi.superadminList();
    setRows(res.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Release notes management</h1>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Create release note</p>
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
            rows={5}
            placeholder="Content"
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          />
          <div className="flex flex-wrap gap-2">
            <input
              className="input w-36"
              placeholder="Version"
              value={form.version}
              onChange={(e) => setForm((p) => ({ ...p, version: e.target.value }))}
            />
            <select
              className="input w-44"
              value={form.targetRole}
              onChange={(e) => setForm((p) => ({ ...p, targetRole: e.target.value as any }))}
            >
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              className="rounded-md border border-border/70 px-3 py-2 text-sm"
              disabled={saving}
              onClick={async () => {
                if (!form.title.trim() || !form.content.trim()) return;
                setSaving(true);
                try {
                  await releaseNotesApi.superadminCreate({
                    title: form.title.trim(),
                    content: form.content.trim(),
                    version: form.version.trim() || undefined,
                    targetRole: form.targetRole,
                  });
                  setForm({ title: '', content: '', version: '', targetRole: 'ALL' });
                  await load();
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Saving...' : 'Create'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="min-w-full text-sm">
          <thead className="border-b border-border/70 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Reads</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((note) => (
              <tr key={note.id} className="border-b border-border/40 align-top">
                <td className="px-3 py-2">
                  {editingId === note.id ? (
                    <div className="space-y-1">
                      <input
                        className="input h-8"
                        value={editForm.title}
                        onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      />
                      <textarea
                        className="w-full rounded-lg border border-border/70 bg-background px-2 py-1 text-xs text-foreground"
                        rows={3}
                        value={editForm.content}
                        onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">{note.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{note.content}</p>
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingId === note.id ? (
                    <select
                      className="input h-8 w-36"
                      value={editForm.targetRole}
                      onChange={(e) => setEditForm((p) => ({ ...p, targetRole: e.target.value as any }))}
                    >
                      {TARGET_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    note.targetRole
                  )}
                </td>
                <td className="px-3 py-2">
                  {editingId === note.id ? (
                    <input
                      className="input h-8 w-28"
                      value={editForm.version}
                      onChange={(e) => setEditForm((p) => ({ ...p, version: e.target.value }))}
                    />
                  ) : (
                    note.version || '-'
                  )}
                </td>
                <td className="px-3 py-2">{note._count?.releaseReads || 0}</td>
                <td className="px-3 py-2">{note.isPublished ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {!note.isPublished ? (
                      <button
                        className="rounded-md border border-border/70 px-2 py-1 text-xs"
                        onClick={async () => {
                          await releaseNotesApi.superadminPublish(note.id);
                          await load();
                        }}
                      >
                        Publish
                      </button>
                    ) : null}
                    {editingId !== note.id ? (
                      <button
                        className="rounded-md border border-border/70 px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingId(note.id);
                          setEditForm({
                            title: note.title || '',
                            content: note.content || '',
                            version: note.version || '',
                            targetRole: (note.targetRole || 'ALL') as any,
                          });
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          className="rounded-md border border-border/70 px-2 py-1 text-xs"
                          onClick={async () => {
                            await releaseNotesApi.superadminUpdate(note.id, {
                              title: editForm.title.trim(),
                              content: editForm.content.trim(),
                              version: editForm.version.trim() || undefined,
                              targetRole: editForm.targetRole,
                            });
                            setEditingId('');
                            await load();
                          }}
                        >
                          Save
                        </button>
                        <button className="rounded-md border border-border/70 px-2 py-1 text-xs" onClick={() => setEditingId('')}>
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      className="rounded-md border border-border/70 px-2 py-1 text-xs"
                      onClick={async () => {
                        await releaseNotesApi.superadminDelete(note.id);
                        await load();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No release notes found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
