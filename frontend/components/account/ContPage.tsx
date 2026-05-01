'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Languages, LogOut, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { settingsApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

type ContPageProps = {
  organizationLabel?: string;
};

export default function ContPage({ organizationLabel = 'Organizație' }: ContPageProps) {
  const { user, org, prefs, updatePreferences, logout } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'ro' | 'ru' | 'en'>('ro');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilizator');
    setPhone((user as any)?.phone || '');
    setLanguage(prefs?.locale || 'ro');
  }, [prefs?.locale, user]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const [firstName, ...rest] = displayName.trim().split(/\s+/);
      await Promise.all([
        settingsApi.updateProfile({ firstName: firstName || '', lastName: rest.join(' ') || '' }).catch(() => null),
        updatePreferences({ locale: language }),
      ]);
      const phoneChanged = phone.trim() !== String((user as any)?.phone || '').trim();
      showToast(phoneChanged ? 'Numele și limba au fost salvate. Telefonul rămâne local momentan.' : 'Setările au fost salvate.');
    } catch {
      showToast('Datele au fost păstrate local. Salvarea completă va fi conectată ulterior.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 overflow-x-hidden pb-24 md:space-y-6 md:pb-8">
      <section className="rounded-[1.75rem] border border-border/70 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" />
          Cont
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Cont</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">Profilul tău, preferințe și acces securizat.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-[1.35rem] border border-border/70 bg-white/90 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
              {(displayName || user?.email || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{displayName || 'Utilizator'}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email || 'Email indisponibil'}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
              <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{user?.email || 'Email indisponibil'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Rol</p>
                <p className="font-medium text-foreground">{user?.role || 'Utilizator'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
              <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{organizationLabel}</p>
                <p className="font-medium text-foreground">{org?.name || 'Indisponibil'}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <form onSubmit={handleSave} className="rounded-[1.35rem] border border-border/70 bg-white/90 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
            <h2 className="text-base font-semibold text-foreground">Date profil</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-foreground">
                Nume afișat
                <input className="input mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Telefon
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-border/70 bg-white px-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <input className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefon indisponibil" />
                </div>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Telefonul este păstrat doar în interfață până când câmpul este conectat în backend.
                </span>
              </label>
            </div>

            <div className="mt-6 border-t border-border/70 pt-5">
              <h2 className="text-base font-semibold text-foreground">Preferințe</h2>
              <label className="mt-4 block text-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-2"><Languages className="h-4 w-4" /> Limbă</span>
                <select className="select mt-1" value={language} onChange={(event) => setLanguage(event.target.value as 'ro' | 'ru' | 'en')}>
                  <option value="ro">Română</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            <div className="mt-6 border-t border-border/70 pt-5">
              <h2 className="text-base font-semibold text-foreground">Securitate</h2>
              <p className="mt-1 text-sm text-muted-foreground">Schimbarea parolei rămâne în fluxul existent de securitate al aplicației.</p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button type="submit" isLoading={saving}>Salvează</Button>
              <Button type="button" variant="danger" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
                Deconectare
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
