'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Languages, LogOut, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, Input, PageHeader } from '@/components/ui';

export default function ResidentAccountPage() {
  const { user, org, prefs, updatePreferences, logout } = useAuth();
  const [name, setName] = useState('Utilizator');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'ro' | 'ru' | 'en'>('ro');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilizator');
    setPhone((user as any)?.phone || '');
    setLanguage(prefs?.locale || 'ro');
  }, [prefs?.locale, user]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updatePreferences({ locale: language }).catch(() => undefined);
    setSaved(true);
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Cont" description="Profilul tău și preferințele aplicației." />
      {saved ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Preferințele au fost salvate local.</div> : null}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-foreground text-xl font-semibold text-background">{name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-foreground">{name}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email || 'Email indisponibil'}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            <Info icon={<Mail className="h-4 w-4" />} label="Email" value={user?.email || 'Email indisponibil'} />
            <Info icon={<ShieldCheck className="h-4 w-4" />} label="Rol" value="Locatar / Proprietar" />
            <Info icon={<UserRound className="h-4 w-4" />} label="Asociație" value={org?.name || 'APC Alba Iulia 75'} />
          </div>
        </Card>
        <Card>
          <form onSubmit={save} className="space-y-5">
            <div>
              <h2 className="font-semibold text-foreground">Date profil</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input label="Nume afișat" value={name} onChange={(event) => setName(event.target.value)} />
                <label className="block space-y-1.5 text-sm font-medium text-foreground">
                  Telefon
                  <div className="flex h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Telefon indisponibil" />
                  </div>
                </label>
              </div>
            </div>
            <div className="border-t border-border/70 pt-5">
              <h2 className="font-semibold text-foreground">Preferințe</h2>
              <label className="mt-4 block space-y-1.5 text-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-2"><Languages className="h-4 w-4" /> Limbă</span>
                <select className="h-11 w-full rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={language} onChange={(event) => setLanguage(event.target.value as 'ro' | 'ru' | 'en')}>
                  <option value="ro">Română</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <div className="border-t border-border/70 pt-5">
              <h2 className="font-semibold text-foreground">Securitate</h2>
              <p className="mt-1 text-sm text-muted-foreground">Deconectarea folosește sesiunea existentă a aplicației.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit">Salvează</Button>
              <Button type="button" variant="danger" onClick={() => logout()}><LogOut className="h-4 w-4" /> Deconectare</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium text-foreground">{value}</p></div>
    </div>
  );
}
