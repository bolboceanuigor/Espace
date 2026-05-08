'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Coins, Pencil, Plus, Ruler } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { tariffsApi } from '@/lib/api';
import { formatMdl } from '@/lib/condo-admin-fallback';

type Tariff = {
  id: string;
  code: string;
  name: string;
  type: 'PER_M2' | 'FIXED_PER_APARTMENT' | 'FIXED';
  calculationType?: 'PER_M2' | 'FIXED_PER_APARTMENT' | 'FIXED';
  amount: number;
  currency: 'MDL';
  unit: string;
  isActive: boolean;
};

const tariffOptions = [
  { id: 'DESERVIRE_BLOC_PER_M2', label: 'Deservire bloc', type: 'PER_M2' as const },
  { id: 'FOND_REPARATIE_PER_M2', label: 'Fond reparație', type: 'PER_M2' as const },
  { id: 'FOND_DEZVOLTARE_FIXED', label: 'Fond dezvoltare', type: 'FIXED_PER_APARTMENT' as const },
];

const emptyForm = {
  id: 'DESERVIRE_BLOC_PER_M2',
  name: 'Deservire bloc',
  type: 'PER_M2' as 'PER_M2' | 'FIXED_PER_APARTMENT' | 'FIXED',
  amount: '',
  isActive: true,
};

export default function AdminTariffsPage() {
  const [rows, setRows] = useState<Tariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [source, setSource] = useState<'api' | 'offline'>('api');

  const loadTariffs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await tariffsApi.list();
      setRows(response.data || []);
      setSource('api');
    } catch {
      setRows([]);
      setSource('offline');
      setError('Nu am putut încărca tarifele. Verifică conexiunea cu API-ul.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTariffs().catch(() => undefined);
  }, [loadTariffs]);

  const activeRows = rows.filter((row) => row.isActive);
  const inactiveRows = rows.filter((row) => !row.isActive);
  const perM2Total = useMemo(
    () => activeRows.filter((row) => row.type === 'PER_M2').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [activeRows],
  );
  const fixedTotal = useMemo(
    () => activeRows.filter((row) => row.type === 'FIXED' || row.type === 'FIXED_PER_APARTMENT').reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [activeRows],
  );

  const openCreate = () => {
    setForm(emptyForm);
    setModalMode('create');
    setError('');
    setSuccessMessage('');
    setModalOpen(true);
  };

  const openEdit = (tariff: Tariff) => {
    setForm({
      id: tariff.id,
      name: tariff.name,
      type: tariff.type,
      amount: String(tariff.amount || ''),
      isActive: tariff.isActive,
    });
    setError('');
    setSuccessMessage('');
    setModalMode('edit');
    setModalOpen(true);
  };

  const selectTariffKind = (id: string) => {
    const option = tariffOptions.find((item) => item.id === id) || tariffOptions[0];
    setForm((current) => ({
      ...current,
      id: option.id,
      name: option.label,
      type: option.type,
    }));
  };

  const saveTariff = async () => {
    setError('');
    setSuccessMessage('');
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Completează o sumă validă.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        amount,
        currency: 'MDL',
        isActive: form.isActive,
        code: form.id,
      } as const;
      if (modalMode === 'create') {
        await tariffsApi.create(payload);
      } else {
        await tariffsApi.update(form.id, payload);
      }
      setModalOpen(false);
      setSuccessMessage('Tariful a fost salvat.');
      await loadTariffs();
    } catch (err: any) {
      const message = String(err?.message || '');
      setError(message || 'Nu am putut salva tariful.');
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateTariff = async (tariff: Tariff) => {
    setError('');
    setSuccessMessage('');
    try {
      await tariffsApi.deactivate(tariff.id);
      setSuccessMessage('Tariful a fost dezactivat.');
      await loadTariffs();
    } catch {
      setError('Nu am putut salva tariful.');
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Tarife APC"
        description="Configurează tarifele lunare pentru deservire bloc, fond reparație și fond dezvoltare."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'API indisponibil'}
            </span>
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Adaugă tarif
            </Button>
          </div>
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      {error && !modalOpen ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tarife active" value={String(activeRows.length)} description={`${inactiveRows.length} inactive`} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Total per m²" value={`${perM2Total.toLocaleString('ro-RO')} MDL`} description="Aplicat la suprafața apartamentului" icon={<Ruler className="h-5 w-5" />} />
        <StatCard label="Sume fixe" value={formatMdl(fixedTotal)} description="Aplicate per apartament" icon={<Coins className="h-5 w-5" />} tone="warning" />
        <StatCard label="Monedă" value="MDL" description="Republica Moldova" icon={<Calculator className="h-5 w-5" />} />
      </section>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tarife active</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Facturile lunare folosesc aceste valori pentru calculul automat pe apartamente active.
            </p>
          </div>
          <ButtonLink href="/admin/invoices" variant="secondary">Generează facturi</ButtonLink>
        </div>
      </Card>

      <section className="grid gap-3 lg:grid-cols-3">
        {rows.map((tariff) => (
          <TariffCard key={tariff.id} tariff={tariff} onEdit={() => openEdit(tariff)} onDeactivate={() => deactivateTariff(tariff)} />
        ))}
        {!loading && !rows.length ? (
          <Card className="p-5 text-sm font-medium text-muted-foreground lg:col-span-3">
            Nu există tarife configurate încă.
          </Card>
        ) : null}
        {loading ? (
          <Card className="p-5 text-sm font-medium text-muted-foreground lg:col-span-3">
            Se încarcă tarifele...
          </Card>
        ) : null}
      </section>

      <Card>
        <h2 className="text-base font-semibold text-foreground">Tarife disponibile în MVP</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aceste trei tarife acoperă calculul lunar de bază pentru A.P.C.: deservire bloc, fond reparație și fond dezvoltare. Alte taxe pot fi adăugate după validarea fluxului financiar inițial.
        </p>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} maxWidth="lg">
        <ModalHeader title={modalMode === 'create' ? 'Adaugă tarif' : 'Editează tarif'} onClose={() => setModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3">
            <label className="block">
              <span className="label">Tip tarif</span>
              <select className="select" value={form.id} onChange={(event) => selectTariffKind(event.target.value)}>
                {tariffOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <Input label="Nume tarif" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            <label className="block">
              <span className="label">Tip calcul</span>
              <select className="select" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as typeof form.type }))}>
                <option value="PER_M2">Per m²</option>
                <option value="FIXED_PER_APARTMENT">Sumă fixă per apartament</option>
              </select>
            </label>
            <Input label="Suma" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
            <label className="block">
              <span className="label">Monedă</span>
              <select className="select" value="MDL" disabled>
                <option value="MDL">MDL</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Activ</span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-5 w-5 rounded border-border"
              />
            </label>
          </div>
          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={isSaving}>
            Anulează
          </Button>
          <Button type="button" onClick={saveTariff} isLoading={isSaving}>
            Salvează tarif
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function TariffCard({ tariff, onEdit, onDeactivate }: { tariff: Tariff; onEdit: () => void; onDeactivate: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{tariff.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tariff.type === 'PER_M2' ? 'Per m²' : 'Sumă fixă per apartament'} · {tariff.unit}</p>
        </div>
        <Badge variant={tariff.isActive ? 'success' : 'neutral'}>{tariff.isActive ? 'Activ' : 'Inactiv'}</Badge>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        {formatMdl(tariff.amount)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {tariff.type === 'PER_M2' ? 'Se înmulțește cu suprafața apartamentului.' : 'Se aplică o dată pentru fiecare apartament.'}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" className="w-full" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Editează
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={onDeactivate} disabled={!tariff.isActive}>
          Dezactivează
        </Button>
      </div>
    </Card>
  );
}
