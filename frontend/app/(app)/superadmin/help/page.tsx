'use client';

import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { helpApi } from '@/lib/api';

const TARGET_ROLES = ['ALL', 'SUPER_ADMIN', 'ADMIN', 'RESIDENT'] as const;
const CATEGORIES = ['GETTING_STARTED', 'PAYMENTS', 'INVOICES', 'RESIDENTS', 'ISSUES', 'SETTINGS', 'OTHER'] as const;

type Draft = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  targetRole: (typeof TARGET_ROLES)[number];
  category: (typeof CATEGORIES)[number];
  isPublished: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: '',
  slug: '',
  content: '',
  targetRole: 'ALL',
  category: 'GETTING_STARTED',
  isPublished: false,
};

export default function SuperadminHelpPage() {
  const t = useTranslations('helpAdmin');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await helpApi.superadminList();
      setItems(res.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setIsLoading(false));
  }, []);

  const isEditing = useMemo(() => Boolean(draft.id), [draft.id]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{isEditing ? t('editArticle') : t('newArticle')}</h2>
          <input
            value={draft.title}
            onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t('titleField')}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            value={draft.slug}
            onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder={t('slug')}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={draft.targetRole}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetRole: e.target.value as Draft['targetRole'] }))}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {TARGET_ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value as Draft['category'] }))}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={draft.content}
            onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
            placeholder={t('content')}
            className="min-h-[220px] w-full rounded-md border border-border bg-background p-3 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) => setDraft((prev) => ({ ...prev, isPublished: e.target.checked }))}
            />
            {t('published')}
          </label>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setIsSaving(true);
                try {
                  if (draft.id) {
                    await helpApi.superadminUpdate(draft.id, draft);
                  } else {
                    await helpApi.superadminCreate(draft);
                  }
                  setDraft(EMPTY_DRAFT);
                  await load();
                } finally {
                  setIsSaving(false);
                }
              }}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {isSaving ? t('saving') : isEditing ? t('update') : t('create')}
            </button>
            {isEditing ? (
              <button
                onClick={() => setDraft(EMPTY_DRAFT)}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                {t('cancel')}
              </button>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t('articles')}</h2>
          {isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/60 p-3">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category} · {item.targetRole} · {item.isPublished ? t('published') : t('draft')}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setDraft(item)}
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={async () => {
                      setIsDeletingId(item.id);
                      try {
                        await helpApi.superadminDelete(item.id);
                        await load();
                      } finally {
                        setIsDeletingId(null);
                      }
                    }}
                    className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive"
                  >
                    {isDeletingId === item.id ? t('deleting') : t('delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

