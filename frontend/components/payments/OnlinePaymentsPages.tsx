'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Ban, CreditCard, Eye, PlugZap, RefreshCw, ShieldAlert, WalletCards } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { invoicesApi, onlinePaymentsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';
import { useLocalizedPath } from '@/lib/use-localized-path';

const statusVariant: Record<string, any> = {
  DRAFT: 'neutral',
  CREATED: 'info',
  PENDING_PROVIDER: 'warning',
  REQUIRES_ACTION: 'warning',
  PROCESSING: 'info',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'neutral',
  EXPIRED: 'warning',
  TESTING: 'warning',
  ACTIVE: 'success',
  DISABLED: 'neutral',
  ERROR: 'error',
  ARCHIVED: 'neutral',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  CREATED: 'Creată',
  PENDING_PROVIDER: 'Așteaptă provider',
  REQUIRES_ACTION: 'Necesită acțiune',
  PROCESSING: 'În procesare',
  SUCCEEDED: 'Succes test',
  FAILED: 'Eșuată',
  CANCELLED: 'Anulată',
  EXPIRED: 'Expirată',
  TESTING: 'Testing',
  ACTIVE: 'Activ',
  DISABLED: 'Dezactivat',
  ERROR: 'Eroare',
  ARCHIVED: 'Arhivat',
};

function PaymentStatusBadge({ status }: { status?: string }) {
  const value = String(status || '').toUpperCase();
  return <Badge variant={statusVariant[value] || 'neutral'}>{statusLabels[value] || value || '-'}</Badge>;
}

function date(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function useLoad(loader: () => Promise<any>, deps: unknown[]) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loader()
      .then((res) => active && setData(res.data ?? res))
      .catch((err) => active && setError(String(err?.message || 'Nu am putut încărca datele.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading, error, setData };
}

function IntentTable({ items, audience }: { items: any[]; audience: 'admin' | 'resident' | 'superadmin' }) {
  const localizedPath = useLocalizedPath();
  const prefix = audience === 'superadmin' ? '/superadmin/payments/intents' : audience === 'resident' ? '/resident/payment-intents' : '/admin/payments/intents';
  if (!items.length) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Nu există intenții de plată</h2>
        <p className="mt-2 text-sm text-muted-foreground">Intențiile de plată online vor apărea aici după activarea providerilor.</p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="py-2">Factura</th><th>Apartament</th><th>Provider</th><th>Status</th><th>Suma</th><th>Creată</th><th>Expiră</th><th>Acțiuni</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 font-medium text-foreground">{item.invoiceNumber || item.invoiceId || '-'}</td>
                <td>{item.apartment?.apartmentNumber || '-'}</td>
                <td>{item.provider?.name || item.providerType || '-'}</td>
                <td><PaymentStatusBadge status={item.status} /></td>
                <td>{formatMdl(item.amount)}</td>
                <td>{date(item.createdAt)}</td>
                <td>{date(item.expiresAt)}</td>
                <td><ButtonLink href={localizedPath(`${prefix}/${item.id}`)} size="sm" variant="secondary"><Eye className="h-4 w-4" /> Deschide</ButtonLink></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function SuperadminPaymentsOverviewPage() {
  const { data } = useLoad(() => onlinePaymentsApi.superadminProviders(), []);
  const providers = data?.items || [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plăți online"
        description="Configurează providerii și urmărește intențiile de plată în interfața Espace."
        rightSlot={<ButtonLink href="/superadmin/payments/providers"><PlugZap className="h-4 w-4" /> Providere de plată</ButtonLink>}
      />
      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label="Provideri" value={providers.length} icon={<PlugZap className="h-5 w-5" />} />
        <StatCard label="Activi/testing" value={providers.filter((p: any) => p.status === 'ACTIVE' || p.status === 'TESTING').length} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label="Providere BPay" value={providers.filter((p: any) => p.type === 'BPAY').length} icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Procesare online" value="Dezactivată" description="Activarea reală se face separat, după integrarea providerilor." icon={<ShieldAlert className="h-5 w-5" />} tone="warning" />
      </section>
      <RecentIntents audience="superadmin" />
    </div>
  );
}

export function SuperadminProvidersPage() {
  const { data, loading } = useLoad(() => onlinePaymentsApi.superadminProviders(), []);
  const items = data?.items || [];
  return (
    <div className="space-y-6">
      <PageHeader title="Providere de plată" description="Configurează providerii de plată disponibili pentru platforma Espace." />
      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}
      {!items.length && !loading ? <Card className="p-8 text-center"><h2 className="text-lg font-semibold">Nu există provideri de plată</h2><p className="mt-2 text-sm text-muted-foreground">Adaugă un provider sau pregătește configurarea pentru activarea ulterioară a plăților online.</p></Card> : null}
      {items.length ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-2">Provider</th><th>Type</th><th>Status</th><th>Mode</th><th>Config</th><th>BPay</th><th>Carduri</th><th>Webhook</th><th>Default</th><th>Acțiuni</th></tr></thead>
              <tbody className="divide-y divide-border">
                {items.map((provider: any) => (
                  <tr key={provider.id}>
                    <td className="py-3 font-medium">{provider.name}</td>
                    <td>{provider.type}</td>
                    <td><PaymentStatusBadge status={provider.status} /></td>
                    <td>{provider.mode}</td>
                    <td>{provider.configStatus}</td>
                    <td>{provider.supportsBpay ? 'Da' : 'Nu'}</td>
                    <td>{provider.supportsCards ? 'Da' : 'Nu'}</td>
                    <td>{provider.supportsWebhooks ? 'Da' : 'Nu'}</td>
                    <td>{provider.isDefault ? 'Da' : 'Nu'}</td>
                    <td><ButtonLink href={`/superadmin/payments/providers/${provider.id}`} size="sm" variant="secondary">Deschide</ButtonLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function SuperadminProviderDetailPage({ id }: { id: string }) {
  const { data, setData } = useLoad(() => onlinePaymentsApi.superadminProvider(id), [id]);
  const provider = data?.provider;
  const health = data?.health;
  async function test() {
    const res = await onlinePaymentsApi.superadminProviderTest(id);
    setData((current: any) => ({ ...(current || {}), test: res.data ?? res }));
  }
  if (!provider) return <Card><p className="text-sm text-muted-foreground">Se încarcă...</p></Card>;
  return (
    <div className="space-y-6">
      <PageHeader title={provider.name} description="Detalii provider fără secrete." rightSlot={<ButtonLink href="/superadmin/payments/providers" variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>} />
      <Card><div className="grid gap-3 md:grid-cols-3"><Info label="Tip" value={provider.type} /><Info label="Status" value={<PaymentStatusBadge status={provider.status} />} /><Info label="Mod" value={provider.mode} /><Info label="Configurație" value={provider.configStatus} /><Info label="Implicit" value={provider.isDefault ? 'Da' : 'Nu'} /><Info label="Activare externă" value={health?.externalEnabled ? 'Da' : 'Nu'} /></div></Card>
      <Card><h2 className="font-semibold">Stare</h2><p className="mt-2 text-sm text-muted-foreground">{health?.message}</p><Button className="mt-4" variant="secondary" onClick={test}><RefreshCw className="h-4 w-4" /> Verifică setările</Button>{data?.test ? <p className="mt-3 text-sm font-semibold">{data.test.message}</p> : null}</Card>
    </div>
  );
}

export function AdminPaymentSettingsPage() {
  const { data, setData } = useLoad(() => onlinePaymentsApi.adminSettings(), []);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  useEffect(() => { if (data) setForm(data); }, [data]);
  async function save() {
    setSaving(true);
    try {
      const res = await onlinePaymentsApi.adminUpdateSettings(form);
      setData(res.data ?? res);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Setări plăți online" description="Pregătește plățile online pentru facturile interne ale asociației." />
      <Card className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Procesarea online reală este dezactivată în mediul curent. Setările sunt disponibile doar
          pentru pregătirea integrării.
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.onlinePaymentsEnabled)} onChange={(e) => setForm({ ...form, onlinePaymentsEnabled: e.target.checked })} /> Plăți online activate</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.allowResidentOnlinePayments)} onChange={(e) => setForm({ ...form, allowResidentOnlinePayments: e.target.checked })} /> Permite locatarilor să creeze intenții</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.allowPartialOnlinePayments)} onChange={(e) => setForm({ ...form, allowPartialOnlinePayments: e.target.checked })} /> Permite plăți parțiale</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.testModeEnabled)} onChange={(e) => setForm({ ...form, testModeEnabled: e.target.checked })} /> Test mode</label>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Suma minimă" type="number" value={form.minPaymentAmount ?? ''} onChange={(e) => setForm({ ...form, minPaymentAmount: e.target.value })} />
          <Input label="Suma maximă" type="number" value={form.maxPaymentAmount ?? ''} onChange={(e) => setForm({ ...form, maxPaymentAmount: e.target.value })} />
        </div>
        <Button onClick={save} isLoading={saving}>Salvează setările</Button>
      </Card>
      {data?.providerHealth ? <Card><h2 className="font-semibold">Provider status</h2><p className="mt-2 text-sm text-muted-foreground">{data.providerHealth.message}</p></Card> : null}
    </div>
  );
}

export function IntentListPage({ audience }: { audience: 'admin' | 'resident' | 'superadmin' }) {
  const loader = () => audience === 'superadmin' ? onlinePaymentsApi.superadminIntents() : audience === 'resident' ? onlinePaymentsApi.residentIntents() : onlinePaymentsApi.adminIntents();
  const { data, loading } = useLoad(loader, [audience]);
  const title = audience === 'resident' ? 'Plăți online' : 'Intenții de plată online';
  return (
    <div className="space-y-6">
      <PageHeader title={title} description="Monitorizează intențiile de plată. Acestea nu sunt plăți confirmate." />
      {loading ? <Card className="h-32 animate-pulse bg-muted/40" /> : null}
      <IntentTable items={data?.items || []} audience={audience} />
    </div>
  );
}

export function IntentDetailPage({ id, audience }: { id: string; audience: 'admin' | 'resident' | 'superadmin' }) {
  const loader = () => audience === 'superadmin' ? onlinePaymentsApi.superadminIntent(id) : audience === 'resident' ? onlinePaymentsApi.residentIntent(id) : onlinePaymentsApi.adminIntent(id);
  const { data, setData } = useLoad(loader, [id, audience]);
  const intent = data?.intent;
  async function cancel() {
    const reason = 'Anulat din interfață.';
    const res = audience === 'superadmin' ? await onlinePaymentsApi.superadminCancelIntent(id, reason) : audience === 'resident' ? await onlinePaymentsApi.residentCancelIntent(id, reason) : await onlinePaymentsApi.adminCancelIntent(id, reason);
    setData({ ...(data || {}), intent: (res.data ?? res).intent });
  }
  if (!intent) return <Card><p className="text-sm text-muted-foreground">Se încarcă...</p></Card>;
  return (
    <div className="space-y-6">
      <PageHeader title={`Intent ${intent.id.slice(0, 8)}`} description={intent.message} rightSlot={<ButtonLink href={audience === 'resident' ? '/resident/payments/online' : audience === 'superadmin' ? '/superadmin/payments/intents' : '/admin/payments/intents'} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi</ButtonLink>} />
      <Card><div className="grid gap-3 md:grid-cols-3"><Info label="Status" value={<PaymentStatusBadge status={intent.status} />} /><Info label="Suma" value={formatMdl(intent.amount)} /><Info label="Factura" value={intent.invoiceNumber || intent.invoiceId || '-'} /><Info label="Provider" value={intent.provider?.name || intent.providerType || '-'} /><Info label="Metodă" value={intent.paymentMethodType || '-'} /><Info label="Expiră" value={date(intent.expiresAt)} /></div></Card>
      <Card><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Această intenție nu procesează bani și nu modifică soldul facturii.</div>{['CREATED', 'PENDING_PROVIDER', 'REQUIRES_ACTION', 'PROCESSING'].includes(intent.status) ? <Button className="mt-4" variant="secondary" onClick={cancel}><Ban className="h-4 w-4" /> Anulează</Button> : null}</Card>
      <Card><h2 className="font-semibold">Timeline</h2><div className="mt-3 divide-y divide-border">{(data.events || []).map((event: any) => <div key={event.id} className="py-3 text-sm"><p className="font-medium">{event.title}</p><p className="text-muted-foreground">{event.message}</p><p className="text-xs text-muted-foreground">{date(event.createdAt)}</p></div>)}</div></Card>
    </div>
  );
}

export function ResidentPayInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');
  const localizedPath = useLocalizedPath();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('TEST_METHOD');
  const [created, setCreated] = useState<any>(null);
  const { data } = useLoad(() => Promise.all([invoicesApi.residentGetOne(id), onlinePaymentsApi.residentIntents({ invoiceId: id })]).then(([invoice, intents]) => ({ data: { invoice: invoice.data, intents: intents.data } })), [id]);
  const invoice = data?.invoice?.invoice;
  useEffect(() => { if (invoice && !amount) setAmount(String(invoice.balanceAmount || 0)); }, [invoice, amount]);
  async function create() {
    const res = await onlinePaymentsApi.residentCreateIntent(id, { amount: Number(amount), paymentMethodType: method });
    setCreated(res.data ?? res);
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Achită online" description="Plățile online sunt în pregătire." rightSlot={<ButtonLink href={localizedPath(`/resident/invoices/${id}`)} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi la factură</ButtonLink>} />
      <Card className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          În curând vei putea achita factura direct din portal. Acum poți crea doar o intenție de plată de test, fără procesare bani.
        </div>
        {invoice ? <div className="grid gap-3 md:grid-cols-4"><Info label="Factură" value={invoice.invoiceNumber} /><Info label="Total" value={formatMdl(invoice.totalAmount)} /><Info label="Achitat" value={formatMdl(invoice.paidAmount)} /><Info label="Sold" value={formatMdl(invoice.balanceAmount)} /></div> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Suma de achitat" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <label className="text-sm font-semibold">Metodă
            <select className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="TEST_METHOD">TEST_METHOD</option>
              <option value="BPAY" disabled>BPAY - neconectat</option>
              <option value="ONLINE_CARD" disabled>ONLINE_CARD - neconectat</option>
            </select>
          </label>
        </div>
        <Button onClick={create}>Creează intenție de plată</Button>
        {created?.intent ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Intent creat: <Link className="font-semibold underline" href={localizedPath(`/resident/payment-intents/${created.intent.id}`)}>deschide detalii</Link></div> : null}
      </Card>
      <IntentTable items={data?.intents?.items || []} audience="resident" />
    </div>
  );
}

export function AdminInvoiceIntentsPage({ id }: { id: string }) {
  const { data, setData } = useLoad(() => onlinePaymentsApi.adminInvoiceIntents(id), [id]);
  async function createTest() {
    const res = await onlinePaymentsApi.adminCreateInvoiceIntent(id, { paymentMethodType: 'TEST_METHOD' });
    const refreshed = await onlinePaymentsApi.adminInvoiceIntents(id);
    setData(refreshed.data ?? refreshed);
    return res;
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Payment intents factură" description="Intențiile nu contează ca încasări reale." rightSlot={<ButtonLink href={`/admin/invoices/${id}`} variant="secondary"><ArrowLeft className="h-4 w-4" /> Înapoi la factură</ButtonLink>} />
      {data?.invoice ? <Card><div className="grid gap-3 md:grid-cols-4"><Info label="Factură" value={data.invoice.invoiceNumber} /><Info label="Status" value={data.invoice.status} /><Info label="Sold" value={formatMdl(data.invoice.balanceAmount)} /><Info label="Total" value={formatMdl(data.invoice.totalAmount)} /></div><Button className="mt-4" variant="secondary" onClick={createTest}>Creează intent test</Button></Card> : null}
      <IntentTable items={data?.items || []} audience="admin" />
    </div>
  );
}

function RecentIntents({ audience }: { audience: 'superadmin' | 'admin' | 'resident' }) {
  const { data } = useLoad(() => audience === 'superadmin' ? onlinePaymentsApi.superadminIntents({ limit: 5 }) : onlinePaymentsApi.adminIntents({ limit: 5 }), [audience]);
  return <IntentTable items={data?.items || []} audience={audience} />;
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-muted/35 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-semibold text-foreground">{value || '-'}</div>
    </div>
  );
}
