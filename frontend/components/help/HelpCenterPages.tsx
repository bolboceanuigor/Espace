'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { helpApi } from '@/lib/api';

type Audience = 'PUBLIC' | 'SUPERADMIN' | 'ADMIN' | 'STAFF' | 'RESIDENT';
type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  body?: string;
  content?: string;
  type?: string;
  status?: string;
  audience?: Audience[];
  tags?: string[];
  locale?: string;
  isFeatured?: boolean;
  relatedRoute?: string;
  relatedModule?: string;
  estimatedReadMinutes?: number;
  updatedAt?: string;
  category?: { id?: string; slug?: string; title?: string } | string;
};
type HelpCategory = { id: string; slug: string; title: string; description?: string; audience?: Audience[]; status?: string; sortOrder?: number };

const AUDIENCES: Audience[] = ['PUBLIC', 'SUPERADMIN', 'ADMIN', 'STAFF', 'RESIDENT'];
const ARTICLE_TYPES = ['GUIDE', 'FAQ', 'TROUBLESHOOTING', 'CHECKLIST', 'RELEASE_NOTE', 'POLICY', 'HOW_TO'];
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

function useLocale() {
  const params = useParams<{ locale?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function categoryTitle(article: Article) {
  return typeof article.category === 'string' ? article.category : article.category?.title || 'Ajutor';
}

function categorySlug(article: Article) {
  return typeof article.category === 'string' ? article.category : article.category?.slug || 'general';
}

function bodyOf(article: Article) {
  return article.body || article.content || '';
}

function MarkdownLite({ value }: { value?: string }) {
  const lines = (value || '').split('\n');
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="ml-5 list-disc space-y-1">
        {list.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      nodes.push(<div key={`sp-${index}`} className="h-2" />);
      return;
    }
    if (line.startsWith('- ') || /^\d+\.\s/.test(line)) {
      list.push(line.replace(/^-\s/, '').replace(/^\d+\.\s/, ''));
      return;
    }
    flushList();
    if (line.startsWith('## ')) nodes.push(<h2 key={index} className="mt-5 text-xl font-semibold text-slate-950">{line.slice(3)}</h2>);
    else if (line.startsWith('# ')) nodes.push(<h1 key={index} className="mt-5 text-2xl font-semibold text-slate-950">{line.slice(2)}</h1>);
    else if (line.toLowerCase().startsWith('important:') || line.toLowerCase().startsWith('atentie:')) {
      nodes.push(<div key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{line}</div>);
    } else {
      nodes.push(<p key={index} className="leading-7 text-slate-700">{line}</p>);
    }
  });
  flushList();
  return <div className="space-y-3">{nodes}</div>;
}

function HelpCard({ article, href }: { article: Article; href: string }) {
  return (
    <Link href={href} className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{article.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{article.excerpt || bodyOf(article).slice(0, 140)}</p>
        </div>
        {article.isFeatured ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Recomandat</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>{categoryTitle(article)}</span>
        {article.estimatedReadMinutes ? <span>{article.estimatedReadMinutes} min</span> : null}
      </div>
    </Link>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
    </div>
  );
}

export function HelpHomePage({ mode = 'public' }: { mode?: 'public' | 'admin' | 'resident' }) {
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const res = mode === 'admin' ? await helpApi.adminHome() : mode === 'resident' ? await helpApi.residentHome() : await helpApi.home();
      setData(res.data || res);
      setIsLoading(false);
    };
    load().catch(() => setIsLoading(false));
  }, [mode]);

  const articles: Article[] = useMemo(() => data?.articles || [], [data]);
  const categories: HelpCategory[] = useMemo(() => data?.categories || [], [data]);
  const featured: Article[] = useMemo(() => data?.featured || [], [data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter((item) => `${item.title} ${item.excerpt || ''} ${bodyOf(item)}`.toLowerCase().includes(needle));
  }, [articles, search]);

  const title = mode === 'admin' ? 'Ajutor pentru administratori' : mode === 'resident' ? 'Ajutor' : 'Ajutor Espace';
  const subtitle =
    mode === 'resident'
      ? 'Raspunsuri simple pentru facturi, plati, contoare si solicitari.'
      : 'Ghiduri si raspunsuri pentru administratori, locatari si echipa Espace.';

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cauta in articole..."
            className="mt-5 h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-500"
          />
        </header>

        {isLoading ? <LoadingBlock /> : null}

        {!isLoading && !articles.length ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-slate-950">Nu exista articole de ajutor</h2>
            <p className="mt-2 text-sm text-slate-500">Ghidurile vor aparea aici dupa publicare.</p>
          </section>
        ) : null}

        {featured.length ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ghiduri recomandate</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((article) => (
                <HelpCard key={article.id} article={article} href={`/${locale}/${mode === 'public' ? 'help' : `${mode}/help`}/${article.slug}`} />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Categorii</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/${locale}/help/categories/${category.slug}`}
                className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300"
              >
                <p className="font-semibold text-slate-950">{category.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{category.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Articole</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((article) => (
              <HelpCard key={article.id} article={article} href={`/${locale}/${mode === 'public' ? 'help' : `${mode}/help`}/${article.slug}`} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export function HelpCategoryPage() {
  const params = useParams<{ slug: string }>();
  const locale = useLocale();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const res = await helpApi.list({ category: params.slug });
      setArticles(res.data?.items || res.data || []);
      setIsLoading(false);
    };
    if (params.slug) load().catch(() => setIsLoading(false));
  }, [params.slug]);
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href={`/${locale}/help`} className="text-sm font-medium text-emerald-700 hover:underline">Inapoi la Help Center</Link>
        <h1 className="text-2xl font-semibold text-slate-950">Categoria {params.slug}</h1>
        {isLoading ? <LoadingBlock /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {articles.map((article) => <HelpCard key={article.id} article={article} href={`/${locale}/help/${article.slug}`} />)}
        </div>
      </div>
    </main>
  );
}

export function HelpArticlePage({ mode = 'public' }: { mode?: 'public' | 'admin' | 'resident' }) {
  const params = useParams<{ slug: string }>();
  const locale = useLocale();
  const [data, setData] = useState<{ article: Article; relatedArticles?: Article[] } | null>(null);
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setIsError(false);
      const res = await helpApi.getBySlug(params.slug);
      setData(res.data || res);
      setIsLoading(false);
    };
    if (params.slug) load().catch(() => {
      setIsError(true);
      setIsLoading(false);
    });
  }, [params.slug]);

  const backHref = `/${locale}/${mode === 'public' ? 'help' : `${mode}/help`}`;
  if (isLoading) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-3xl"><LoadingBlock /></div></main>;
  if (isError || !data?.article) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-semibold text-slate-950">Articolul nu a fost gasit</h1>
          <Link href={backHref} className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:underline">Inapoi la Help Center</Link>
        </div>
      </main>
    );
  }

  const article = data.article;
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <article className="mx-auto max-w-3xl space-y-5">
        <Link href={backHref} className="text-sm font-medium text-emerald-700 hover:underline">Inapoi la Help Center</Link>
        <header className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{categoryTitle(article)}</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{article.title}</h1>
          {article.excerpt ? <p className="mt-3 text-slate-600">{article.excerpt}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{article.type || 'GUIDE'}</span>
            {article.estimatedReadMinutes ? <span>{article.estimatedReadMinutes} min citire</span> : null}
          </div>
        </header>
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-base">
          <MarkdownLite value={bodyOf(article)} />
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">A fost util acest articol?</h2>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setFeedback('yes')} className={`h-10 rounded-md px-4 text-sm ${feedback === 'yes' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white'}`}>Da</button>
            <button onClick={() => setFeedback('no')} className={`h-10 rounded-md px-4 text-sm ${feedback === 'no' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white'}`}>Nu</button>
          </div>
          {feedback ? (
            <div className="mt-3 space-y-2">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ce putem imbunatati?" className="min-h-[90px] w-full rounded-md border border-slate-200 p-3 text-sm" />
              <button
                onClick={async () => {
                  await helpApi.feedback(article.id, { helpful: feedback === 'yes', comment });
                  setComment('');
                }}
                className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white"
              >
                Trimite feedback
              </button>
            </div>
          ) : null}
        </section>
        {data.relatedArticles?.length ? (
          <section>
            <h2 className="mb-3 font-semibold text-slate-950">Articole similare</h2>
            <div className="grid gap-3">
              {data.relatedArticles.map((item) => <HelpCard key={item.id} article={item} href={`/${locale}/help/${item.slug}`} />)}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}

export function ContextualHelpDrawer({ route, module, audience = 'ADMIN', title = 'Ajutor' }: { route?: string; module?: string; audience?: 'ADMIN' | 'RESIDENT' | 'SUPERADMIN'; title?: string }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Article[]>([]);
  useEffect(() => {
    if (!open) return;
    const api = audience === 'RESIDENT' ? helpApi.residentContextual : helpApi.adminContextual;
    api({ route, module }).then((res) => setItems(res.data?.items || [])).catch(() => setItems([]));
  }, [open, route, module, audience]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Ajutor</button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/30" onClick={() => setOpen(false)}>
          <aside onClick={(event) => event.stopPropagation()} className="ml-auto h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
              <button onClick={() => setOpen(false)} className="h-9 rounded-md border border-slate-200 px-3 text-sm">Inchide</button>
            </div>
            <div className="mt-5 space-y-3">
              {items.length ? items.map((item) => <HelpCard key={item.id} article={item} href={`/${locale}/help/${item.slug}`} />) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                  <p className="font-medium text-slate-700">Nu exista ghiduri pentru aceasta pagina</p>
                  <p className="mt-1">Cauta in Help Center sau revino mai tarziu.</p>
                </div>
              )}
            </div>
            <Link href={`/${locale}/help`} className="mt-5 inline-flex text-sm font-medium text-emerald-700 hover:underline">Deschide Help Center</Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function ArticleForm({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [draft, setDraft] = useState<any>({
    title: '',
    slug: '',
    excerpt: '',
    categoryId: '',
    type: 'GUIDE',
    status: 'DRAFT',
    audience: ['ADMIN'],
    tagsText: '',
    locale: 'ro',
    isFeatured: false,
    isContextual: false,
    relatedRoute: '',
    relatedModule: '',
    body: '',
    sortOrder: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    helpApi.superadminCategories().then((res) => setCategories(res.data || [])).catch(() => setCategories([]));
    if (articleId) {
      helpApi.superadminGet(articleId).then((res) => {
        const article = res.data || res;
        setDraft({
          ...article,
          categoryId: article.categoryId || article.category?.id || '',
          body: bodyOf(article),
          tagsText: Array.isArray(article.tags) ? article.tags.join(', ') : '',
          audience: Array.isArray(article.audience) ? article.audience : ['ADMIN'],
        });
      }).catch(() => {});
    }
  }, [articleId]);

  const save = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        tags: String(draft.tagsText || '').split(',').map((item) => item.trim()).filter(Boolean),
        sortOrder: Number(draft.sortOrder || 0),
      };
      delete payload.tagsText;
      if (articleId) await helpApi.superadminUpdate(articleId, payload);
      else {
        const res = await helpApi.superadminCreate(payload);
        const created = res.data || res;
        if (created?.id) router.push(`/superadmin/help/articles/${created.id}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Link href="/superadmin/help/articles" className="text-sm font-medium text-emerald-700 hover:underline">Inapoi la articole</Link>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-slate-950">{articleId ? 'Editeaza articol' : 'Articol nou'}</h1>
        <p className="mt-1 text-sm text-slate-500">Markdown simplu, fara HTML raw.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <input value={draft.title} onChange={(e) => setDraft((p: any) => ({ ...p, title: e.target.value }))} placeholder="Titlu" className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <input value={draft.slug} onChange={(e) => setDraft((p: any) => ({ ...p, slug: e.target.value }))} placeholder="slug-articol" className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <textarea value={draft.excerpt || ''} onChange={(e) => setDraft((p: any) => ({ ...p, excerpt: e.target.value }))} placeholder="Rezumat" className="min-h-[80px] w-full rounded-md border border-slate-200 p-3 text-sm" />
          <textarea value={draft.body || ''} onChange={(e) => setDraft((p: any) => ({ ...p, body: e.target.value }))} placeholder="Body markdown" className="min-h-[420px] w-full rounded-md border border-slate-200 p-3 text-sm" />
        </section>
        <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <select value={draft.categoryId || ''} onChange={(e) => setDraft((p: any) => ({ ...p, categoryId: e.target.value }))} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm">
            <option value="">Categorie</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select>
          <select value={draft.type} onChange={(e) => setDraft((p: any) => ({ ...p, type: e.target.value }))} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm">
            {ARTICLE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={draft.status} onChange={(e) => setDraft((p: any) => ({ ...p, status: e.target.value }))} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm">
            {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500">Audience</p>
            {AUDIENCES.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(draft.audience || []).includes(item)} onChange={(e) => setDraft((p: any) => ({ ...p, audience: e.target.checked ? [...(p.audience || []), item] : (p.audience || []).filter((value: string) => value !== item) }))} />
                {item}
              </label>
            ))}
          </div>
          <input value={draft.tagsText || ''} onChange={(e) => setDraft((p: any) => ({ ...p, tagsText: e.target.value }))} placeholder="tag1, tag2" className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <input value={draft.relatedRoute || ''} onChange={(e) => setDraft((p: any) => ({ ...p, relatedRoute: e.target.value }))} placeholder="/admin/billing" className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <input value={draft.relatedModule || ''} onChange={(e) => setDraft((p: any) => ({ ...p, relatedModule: e.target.value }))} placeholder="BILLING" className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isFeatured} onChange={(e) => setDraft((p: any) => ({ ...p, isFeatured: e.target.checked }))} /> Featured</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isContextual} onChange={(e) => setDraft((p: any) => ({ ...p, isContextual: e.target.checked }))} /> Contextual</label>
          <button onClick={save} disabled={isSaving} className="h-10 w-full rounded-md bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-60">{isSaving ? 'Se salveaza...' : 'Salveaza'}</button>
        </aside>
      </div>
    </div>
  );
}

export function SuperadminHelpPage() {
  const locale = useLocale();
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    helpApi.superadminStats().then((res) => setStats(res.data || res)).catch(() => {});
  }, []);
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-semibold text-slate-950">Help & Docs</h1>
          <p className="mt-2 text-slate-600">Gestioneaza documentatia si ghidurile din aplicatie.</p>
        </header>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ['Publicate', stats?.published ?? 0],
            ['Draft', stats?.draft ?? 0],
            ['Arhivate', stats?.archived ?? 0],
            ['Feedback negativ', stats?.negativeFeedback ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Link href={`/${locale}/superadmin/help/articles`} className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-950">Articole</Link>
          <Link href={`/${locale}/superadmin/help/categories`} className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-950">Categorii</Link>
          <Link href={`/${locale}/superadmin/help/feedback`} className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-950">Feedback</Link>
        </div>
      </div>
    </main>
  );
}

export function SuperadminArticlesPage() {
  const locale = useLocale();
  const [items, setItems] = useState<Article[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    helpApi.superadminList().then((res) => setItems(res.data || [])).catch(() => {});
  }, []);
  const load = async () => {
    const res = await helpApi.superadminList(search ? { search } : undefined);
    setItems(res.data || []);
  };
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <div><h1 className="text-2xl font-semibold text-slate-950">Help Articles</h1><p className="text-sm text-slate-500">Gestioneaza documentatia si ghidurile.</p></div>
          <Link href={`/${locale}/superadmin/help/articles/new`} className="h-10 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Articol nou</Link>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cauta..." className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" />
            <button onClick={load} className="h-10 rounded-md border border-slate-200 px-4 text-sm">Cauta</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Titlu</th><th>Categorie</th><th>Tip</th><th>Audience</th><th>Status</th><th>Actiuni</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium text-slate-950">{item.title}</td>
                    <td>{categoryTitle(item)}</td>
                    <td>{item.type}</td>
                    <td>{Array.isArray(item.audience) ? item.audience.join(', ') : '-'}</td>
                    <td><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{item.status}</span></td>
                    <td className="space-x-2">
                      <Link href={`/${locale}/superadmin/help/articles/${item.id}`} className="text-emerald-700 hover:underline">Deschide</Link>
                      <Link href={`/${locale}/superadmin/help/articles/${item.id}/edit`} className="text-slate-700 hover:underline">Editeaza</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

export function SuperadminArticleFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ id?: string }>();
  return <main className="min-h-screen bg-slate-50"><ArticleForm articleId={edit ? params.id : undefined} /></main>;
}

export function SuperadminArticleDetailsPage() {
  const params = useParams<{ id: string }>();
  const locale = useLocale();
  const [article, setArticle] = useState<Article | null>(null);
  useEffect(() => { if (params.id) helpApi.superadminGet(params.id).then((res) => setArticle(res.data || res)).catch(() => {}); }, [params.id]);
  if (!article) return <main className="min-h-screen bg-slate-50 p-6"><LoadingBlock /></main>;
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href={`/${locale}/superadmin/help/articles`} className="text-sm font-medium text-emerald-700 hover:underline">Inapoi</Link>
        <header className="rounded-lg border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-semibold text-slate-950">{article.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{article.status} · {categoryTitle(article)}</p>
          <div className="mt-3 flex gap-2">
            <Link href={`/${locale}/superadmin/help/articles/${article.id}/edit`} className="h-10 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Editeaza</Link>
            <button onClick={() => helpApi.superadminDuplicate(article.id)} className="h-10 rounded-md border border-slate-200 px-4 text-sm">Duplicate</button>
          </div>
        </header>
        <section className="rounded-lg border border-slate-200 bg-white p-5"><MarkdownLite value={bodyOf(article)} /></section>
      </div>
    </main>
  );
}

export function SuperadminCategoriesPage() {
  const [items, setItems] = useState<HelpCategory[]>([]);
  const [title, setTitle] = useState('');
  const load = async () => setItems((await helpApi.superadminCategories()).data || []);
  useEffect(() => { load().catch(() => {}); }, []);
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-950">Categorii Help</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Categorie noua" className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" /><button onClick={async () => { await helpApi.superadminCreateCategory({ title, audience: ['PUBLIC'] }); setTitle(''); await load(); }} className="h-10 rounded-md bg-emerald-600 px-4 text-sm text-white">Adauga</button></div>
          <div className="mt-4 divide-y divide-slate-100">{items.map((item) => <div key={item.id} className="py-3"><p className="font-medium text-slate-950">{item.title}</p><p className="text-sm text-slate-500">{item.slug} · {item.status}</p></div>)}</div>
        </div>
      </div>
    </main>
  );
}

export function SuperadminFeedbackPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { helpApi.superadminFeedback().then((res) => setItems(res.data || [])).catch(() => {}); }, []);
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-950">Help feedback</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {items.length ? items.map((item) => <div key={item.id} className="border-b border-slate-100 py-3"><p className="font-medium text-slate-950">{item.article?.title}</p><p className="text-sm text-slate-500">{item.helpful ? 'Util' : 'Inutil'} · {item.audience} · {new Date(item.createdAt).toLocaleString('ro-MD')}</p>{item.comment ? <p className="mt-1 text-sm text-slate-700">{item.comment}</p> : null}</div>) : <p className="text-sm text-slate-500">Nu exista feedback.</p>}
        </div>
      </div>
    </main>
  );
}

export function AdminOnboardingGuidePage() {
  const [data, setData] = useState<any>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => {
    helpApi.onboardingGuide().then((res) => {
      const payload = res.data || res;
      setData(payload);
      setCompleted((payload.guide?.steps || []).filter((step: any) => step.completed).map((step: any) => step.id));
    }).catch(() => {});
  }, []);
  const steps = data?.guide?.steps || [];
  const toggle = async (id: string) => {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    setCompleted(next);
    await helpApi.updateOnboardingProgress({ guideKey: 'ADMIN_FIRST_SETUP', completedSteps: next });
  };
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-semibold text-slate-950">Ghid de configurare</h1>
          <p className="mt-2 text-slate-600">Parcurge pasii principali pentru un APC nou. Ghidul nu blocheaza aplicatia.</p>
          <p className="mt-4 text-sm font-medium text-emerald-700">{completed.length}/{steps.length} pasi completati</p>
        </header>
        <div className="space-y-3">
          {steps.length ? steps.map((step: any, index: number) => (
            <section key={step.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(step.id)} className={`mt-1 h-7 w-7 rounded-full border text-sm ${completed.includes(step.id) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>{completed.includes(step.id) ? '✓' : index + 1}</button>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-950">{step.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                  <Link href={step.href || '/admin'} className="mt-3 inline-flex text-sm font-medium text-emerald-700 hover:underline">Deschide pagina</Link>
                </div>
              </div>
            </section>
          )) : (
            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-950">Ghidul de onboarding nu este configurat</h2>
              <p className="mt-2 text-sm text-slate-500">Pasii de configurare vor aparea aici dupa initializare.</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
