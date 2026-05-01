'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Mail, MessageCircle, Phone, Search, UserRound, Users, UserX } from 'lucide-react';
import { Badge, Card, Input, PageHeader, StatCard } from '@/components/ui';
import { formatMdl } from '@/lib/condo-admin-fallback';

type PersonRole = 'proprietar' | 'locatar' | 'chiriaș' | 'membru familie' | 'reprezentant';
type AccountStatus = 'cont creat' | 'invitat' | 'fără cont';

const people = [
  { id: 'popescu-ion', name: 'Popescu Ion', phone: '+373 69 111 222', email: 'ion.popescu@example.com', apartments: ['45'], role: 'proprietar' as PersonRole, accountStatus: 'cont creat' as AccountStatus, debt: 1240 },
  { id: 'popescu-ana', name: 'Popescu Ana', phone: '+373 69 111 223', email: 'ana.popescu@example.com', apartments: ['45'], role: 'membru familie' as PersonRole, accountStatus: 'cont creat' as AccountStatus, debt: 1240 },
  { id: 'ionescu-maria', name: 'Ionescu Maria', phone: '+373 68 333 444', email: 'maria.ionescu@example.com', apartments: ['18'], role: 'proprietar' as PersonRole, accountStatus: 'invitat' as AccountStatus, debt: 0 },
  { id: 'ceban-andrei', name: 'Ceban Andrei', phone: '+373 67 555 666', email: 'andrei.ceban@example.com', apartments: ['72'], role: 'chiriaș' as PersonRole, accountStatus: 'fără cont' as AccountStatus, debt: 3860 },
];

const accountVariant: Record<AccountStatus, 'success' | 'warning' | 'neutral'> = {
  'cont creat': 'success',
  invitat: 'warning',
  'fără cont': 'neutral',
};

export default function AdminResidentsPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('toate');
  const [account, setAccount] = useState('toate');
  const [withDebt, setWithDebt] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      const matchesQuery = !needle || `${person.name} ${person.phone} ${person.email} ${person.apartments.join(' ')}`.toLowerCase().includes(needle);
      const matchesRole = role === 'toate' || person.role === role;
      const matchesAccount = account === 'toate' || person.accountStatus === account;
      const matchesDebt = !withDebt || person.debt > 0;
      return matchesQuery && matchesRole && matchesAccount && matchesDebt;
    });
  }, [account, query, role, withDebt]);

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Locatari" description="Persoane conectate la apartamente: proprietari, chiriași, membri de familie și reprezentanți." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total locatari" value="98" description="Conturi și persoane asociate" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Proprietari" value="64" description="Persoane cu rol proprietar" icon={<UserRound className="h-5 w-5" />} tone="success" />
        <StatCard label="Fără cont creat" value="44" description="Necesită invitație" icon={<UserX className="h-5 w-5" />} tone="warning" />
        <StatCard label="Cu datorii" value="37" description="Datorie pe apartament" icon={<MessageCircle className="h-5 w-5" />} tone="danger" />
      </section>
      <Card>
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută nume, telefon, email sau apartament" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Select value={role} onChange={setRole} options={['toate', 'proprietar', 'locatar', 'chiriaș', 'membru familie', 'reprezentant']} />
          <Select value={account} onChange={setAccount} options={['toate', 'cont creat', 'invitat', 'fără cont']} />
          <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-white px-3 text-sm font-medium text-foreground">
            <input type="checkbox" checked={withDebt} onChange={(event) => setWithDebt(event.target.checked)} />
            Cu datorii
          </label>
        </div>
      </Card>
      <section className="grid gap-3 lg:grid-cols-2">
        {filtered.map((person) => (
          <Card key={person.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">{person.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{person.role} · Apt. {person.apartments.join(', ')}</p>
              </div>
              <Badge variant={accountVariant[person.accountStatus]}>{person.accountStatus}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{person.phone}</span>
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{person.email}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <p className={person.debt > 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>{formatMdl(person.debt)}</p>
              <div className="flex gap-2">
                <Link href={`/admin/residents/${person.id}`} className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Deschide</Link>
                <Link href="/admin/chat" className="rounded-xl border border-border/70 px-3 py-2 text-xs font-semibold hover:bg-muted/60">Mesaj</Link>
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((item) => <option key={item} value={item}>{item === 'toate' ? 'Toate' : item}</option>)}
    </select>
  );
}
