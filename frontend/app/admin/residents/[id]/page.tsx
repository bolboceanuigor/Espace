'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Banknote, Building2, FileText, KeyRound, MessageCircle, Phone, StickyNote, UserRound } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Input, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatCard } from '@/components/ui';
import { defaultLocale, isLocale } from '@/i18n';
import { invitationsApi, residentsApi } from '@/lib/api';
import {
  accountStatusVariant,
  adminApartments,
  findResidentById,
  normalizeApiResident,
  normalizeApiResidentApartments,
  normalizeApiResidentIssues,
  normalizeApiResidentMessages,
  type AdminResident,
} from '@/lib/admin-mvp-data';
import { formatMdl } from '@/lib/condo-admin-fallback';

export default function AdminResidentDetailPage() {
  const params = useParams<{ id?: string; locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const locale = isLocale(localeParam) ? localeParam : defaultLocale;
  const id = typeof params?.id === 'string' ? params.id : '';
  const fallbackResident = useMemo(() => findResidentById(id), [id]);
  const [resident, setResident] = useState<AdminResident>(fallbackResident);
  const [apiDetail, setApiDetail] = useState<any>(null);
  const [source, setSource] = useState<'api' | 'mock'>('mock');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ email: '', phone: '', sendEmail: false });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [inviteWarning, setInviteWarning] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const apartments =
    source === 'api'
      ? normalizeApiResidentApartments(apiDetail)
      : adminApartments.filter((apartment) => resident.apartments.includes(apartment.number));
  const issues = source === 'api' ? normalizeApiResidentIssues(apiDetail) : [];
  const messages = source === 'api' ? normalizeApiResidentMessages(apiDetail) : [];
  const visibleMessages = messages.length
    ? messages
    : source === 'mock'
      ? [{ id: 'mock-message', subject: 'Mesaj trimis administratorului despre citirea contorului.', apartment: `Apt. ${resident.apartments[0] || '-'}` }]
      : [];
  const visibleIssues = issues.length
    ? issues
    : source === 'mock'
      ? [{ id: 'mock-issue', title: 'Verificare presiune apă caldă', status: 'În lucru', apartment: `Apt. ${resident.apartments[0] || '-'}` }]
      : [];
  const firstApartmentId = apartments[0]?.id || '';
  const hasUserAccount = Boolean(resident.userId) || resident.accountStatus === 'cont creat';

  const loadResident = useCallback(async (shouldApply: () => boolean = () => true) => {
    if (!id) return;
    await residentsApi
      .get(id)
      .then((res) => {
        if (!shouldApply()) return;
        setApiDetail(res.data);
        setResident(normalizeApiResident(res.data));
        setSource('api');
      })
      .catch(() => {
        if (!shouldApply()) return;
        setApiDetail(null);
        setResident(fallbackResident);
        setSource('mock');
      });
  }, [fallbackResident, id]);

  useEffect(() => {
    let active = true;
    loadResident(() => active);
    return () => {
      active = false;
    };
  }, [loadResident]);

  useEffect(() => {
    if (!accountModalOpen) return;
    setAccountForm({
      email: resident.email && resident.email !== '-' ? resident.email : '',
      phone: resident.phone && resident.phone !== '-' ? resident.phone : '',
      sendEmail: false,
    });
    setAccountError('');
    setInvitationLink('');
    setInviteWarning('');
  }, [accountModalOpen, resident.email, resident.phone]);

  const createResidentInvitation = async () => {
    setAccountError('');
    setSuccessMessage('');
    setInvitationLink('');
    setInviteWarning('');
    if (!accountForm.email.trim()) {
      setAccountError('Completează emailul.');
      return;
    }
    setIsCreatingAccount(true);
    try {
      const created = await invitationsApi.createResident(id, {
        email: accountForm.email.trim(),
        phone: accountForm.phone.trim() || undefined,
        sendEmail: accountForm.sendEmail,
      });
      const link = created.data?.activationLink || created.data?.inviteLink || '';
      setInvitationLink(link);
      setInviteWarning(created.data?.warning || '');
      setSuccessMessage(
        created.data?.emailSent
          ? 'Invitația a fost trimisă pe email.'
          : 'Invitația a fost creată. Copiază linkul și trimite-l manual.',
      );
      await loadResident();
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('Există deja un utilizator cu acest email')) {
        setAccountError('Există deja un utilizator cu acest email.');
      } else if (message.includes('Acest locatar are deja cont')) {
        setAccountError('Acest locatar are deja cont.');
      } else {
        setAccountError('Nu am putut crea invitația locatarului.');
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <Link href={`/${locale}/admin/residents`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Înapoi la locatari
      </Link>

      <PageHeader
        title={resident.name}
        description={`${resident.role} · Apt. ${resident.apartments.join(', ')}`}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
              {source === 'api' ? 'Date reale' : 'Date temporare — API indisponibil'}
            </span>
            <Badge variant={accountStatusVariant[resident.accountStatus]}>{resident.accountStatus}</Badge>
            {!hasUserAccount && source === 'api' ? <Badge variant="neutral">Fără cont</Badge> : null}
          </div>
        }
      />

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50/70">
          <p className="text-sm font-semibold text-emerald-800">{successMessage}</p>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Telefon" value={resident.phone} description={resident.email} icon={<Phone className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Rol" value={resident.role} description="Rol în asociație" icon={<UserRound className="h-5 w-5" />} tone="success" />
        <StatCard label="Apartamente" value={resident.apartments.join(', ')} description={`${apartments.length} apartament(e) asociate`} icon={<Building2 className="h-5 w-5" />} tone="neutral" />
        <StatCard label="Datorie asociată" value={formatMdl(resident.debt)} description={resident.debt > 0 ? 'Există sold neachitat' : 'Fără datorii'} icon={<Banknote className="h-5 w-5" />} tone={resident.debt > 0 ? 'danger' : 'success'} />
      </section>

      <Card>
        <SectionTitle icon={<UserRound className="h-5 w-5" />} title="Fișă CRM locatar" description="Privire rapidă asupra relației cu acest locatar." />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CrmPill title="Profil" detail="Date de contact și status cont" />
          <CrmPill title="Apartamente" detail={`${apartments.length} apartament(e) conectate`} />
          <CrmPill title="Facturi / datorii" detail={resident.debt > 0 ? formatMdl(resident.debt) : 'Fără datorii'} />
          <CrmPill title="Cereri" detail={`${visibleIssues.length} în evidență`} />
          <CrmPill title="Mesaje" detail={visibleMessages.length ? 'Istoric disponibil' : 'Fără mesaje'} />
          <CrmPill title="Plăți" detail="Vizibile în fișa apartamentului" />
          <CrmPill title="Note interne" detail="Funcție în lucru" muted />
          <CrmPill title="Ultima activitate" detail={visibleIssues[0]?.status ? `Cerere: ${visibleIssues[0].status}` : 'Nu există activitate recentă'} />
        </div>
      </Card>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ButtonLink href={`/${locale}/admin/chat`} variant="primary"><MessageCircle className="h-4 w-4" /> Trimite mesaj</ButtonLink>
          <ButtonLink href={firstApartmentId ? `/${locale}/admin/apartments/${firstApartmentId}` : `/${locale}/admin/apartments`} variant="secondary"><Building2 className="h-4 w-4" /> Vezi apartamentul</ButtonLink>
          <ButtonLink href={`/${locale}/admin/payments`} variant="secondary"><Banknote className="h-4 w-4" /> Înregistrează plată</ButtonLink>
          <ButtonLink href={`/${locale}/admin/issues`} variant="secondary"><FileText className="h-4 w-4" /> Creează cerere</ButtonLink>
          <Button type="button" variant="secondary" disabled title="Funcție în lucru">
            <StickyNote className="h-4 w-4" />
            Adaugă sarcină
          </Button>
          <Button type="button" variant="secondary" disabled title="Funcție în lucru">
            <StickyNote className="h-4 w-4" />
            Adaugă notă
          </Button>
          {!hasUserAccount && source === 'api' ? (
            <Button type="button" variant="secondary" onClick={() => setAccountModalOpen(true)}>
              <KeyRound className="h-4 w-4" />
              {resident.accountStatus === 'invitat' ? 'Retrimite invitația' : 'Invită locatar'}
            </Button>
          ) : (
            <ButtonLink href={`/${locale}/admin/residents`} variant="secondary"><UserRound className="h-4 w-4" /> Lista locatari</ButtonLink>
          )}
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <SectionTitle icon={<UserRound className="h-5 w-5" />} title="Profil" description="Date de contact și status cont." />
          <InfoGrid
            rows={[
              ['Nume complet', resident.name],
              ['Telefon', resident.phone],
              ['Email', resident.email],
              ['Rol', <span key="role" className="capitalize">{resident.role}</span>],
              ['Status cont', <Badge key="account" variant={accountStatusVariant[resident.accountStatus]}>{resident.accountStatus}</Badge>],
            ]}
          />
        </Card>

        <Card>
          <SectionTitle icon={<Building2 className="h-5 w-5" />} title="Apartamente" description="Unități locative asociate profilului." />
          <div className="grid gap-3 md:grid-cols-2">
            {apartments.map((apartment: any) => (
              <Link key={apartment.id} href={`/${locale}/admin/apartments/${apartment.id}`} className="rounded-2xl border border-border/70 bg-muted/25 p-4 hover:bg-muted/45">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Apt. {apartment.number}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{typeof apartment.staircase === 'string' ? apartment.staircase : apartment.staircase?.name} · Etaj {apartment.floor}</p>
                  </div>
                  <Badge variant={apartment.debt > 0 ? 'error' : 'success'}>{apartment.debt > 0 ? 'Cu datorii' : 'Achitat'}</Badge>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Sold: <span className="font-semibold text-foreground">{formatMdl(apartment.debt)}</span></p>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card>
          <SectionTitle icon={<Banknote className="h-5 w-5" />} title="Plăți / Datorii" description="Sumar financiar pentru profil." />
          <div className="space-y-3">
            <InfoTile label="Total datorie" value={formatMdl(resident.debt)} danger={resident.debt > 0} />
            <InfoTile label="Status" value={resident.debt > 0 ? 'Întârziat' : 'Achitat'} danger={resident.debt > 0} />
            <InfoTile label="Ultima plată" value={resident.debt > 0 ? 'Martie 2026' : 'Aprilie 2026'} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<MessageCircle className="h-5 w-5" />} title="Mesaje" description="Comunicare rapidă cu administratorul." />
          <div className="space-y-3">
            {visibleMessages.map((message: any) => (
              <p key={message.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                {message.subject} · {message.apartment}
              </p>
            ))}
            {!visibleMessages.length ? (
              <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                Nu există mesaje încă.
              </p>
            ) : null}
            <ButtonLink href={`/${locale}/admin/chat`} variant="secondary" className="w-full justify-center">
              Deschide mesaje
            </ButtonLink>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<FileText className="h-5 w-5" />} title="Cereri" description="Solicitări conectate acestui locatar." />
          <div className="space-y-3">
            {visibleIssues.map((issue: any) => (
              <div key={issue.id} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <p className="text-sm font-medium text-foreground">{issue.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Status: {issue.status} · {issue.apartment}</p>
              </div>
            ))}
            {!visibleIssues.length ? (
              <p className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                Nu există cereri încă.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<StickyNote className="h-5 w-5" />} title="Note interne" description="Vizibile doar administratorilor." />
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
            Funcție în lucru. Modelul dedicat pentru note interne pe locatar nu este conectat încă.
          </p>
        </Card>
      </section>

      <Modal isOpen={accountModalOpen} onClose={() => setAccountModalOpen(false)} maxWidth="lg">
        <ModalHeader title="Invită locatar" onClose={() => setAccountModalOpen(false)} />
        <ModalBody>
          <div className="grid gap-3">
            <Input label="Email" type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} required />
            <Input label="Telefon" value={accountForm.phone} onChange={(event) => setAccountForm((current) => ({ ...current, phone: event.target.value }))} />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground">
              <input type="checkbox" checked={accountForm.sendEmail} onChange={(event) => setAccountForm((current) => ({ ...current, sendEmail: event.target.checked }))} />
              Trimite invitația pe email
            </label>
          </div>
          {invitationLink ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-semibold text-emerald-800">
                {inviteWarning ? 'Invitația a fost creată. Copiază linkul și trimite-l manual.' : 'Invitația locatarului a fost creată.'}
              </p>
              {inviteWarning ? <p className="mt-1 text-xs font-semibold text-amber-700">{inviteWarning}</p> : null}
              <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-900 break-all">
                {invitationLink}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => navigator.clipboard?.writeText(invitationLink)}
              >
                Copiază linkul de invitație
              </Button>
            </div>
          ) : null}
          {accountError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {accountError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Dacă emailul nu este configurat, linkul rămâne disponibil pentru trimitere manuală printr-un canal sigur.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setAccountModalOpen(false)} disabled={isCreatingAccount}>
            Anulează
          </Button>
          <Button type="button" onClick={createResidentInvitation} disabled={isCreatingAccount}>
            {isCreatingAccount ? 'Se creează...' : 'Creează invitația'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/45 text-foreground">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CrmPill({ title, detail, muted }: { title: string; detail: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${muted ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-border/70 bg-muted/25 text-foreground'}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className={`mt-1 text-xs ${muted ? 'text-amber-800' : 'text-muted-foreground'}`}>{detail}</p>
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <InfoTile key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function InfoTile({ label, value, danger }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={`mt-1 text-sm font-semibold ${danger ? 'text-rose-600' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
