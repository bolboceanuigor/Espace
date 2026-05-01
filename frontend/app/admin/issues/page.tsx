'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search, Wrench } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, StatCard } from '@/components/ui';

type RequestStatus = 'nouă' | 'în lucru' | 'rezolvată';
type RequestPriority = 'normală' | 'importantă' | 'urgentă';

const initialRequests = [
  { id: 'req-1', title: 'Infiltrație la balcon după ploaie', apartment: 'Apt. 45', category: 'Apă / infiltrații', priority: 'urgentă' as RequestPriority, status: 'în lucru' as RequestStatus, date: '30 Apr 2026' },
  { id: 'req-2', title: 'Verificare presiune apă caldă', apartment: 'Apt. 45', category: 'Apă caldă', priority: 'importantă' as RequestPriority, status: 'nouă' as RequestStatus, date: '30 Apr 2026' },
  { id: 'req-3', title: 'Bec ars la etajul 3', apartment: 'Scara 1', category: 'Spații comune', priority: 'normală' as RequestPriority, status: 'rezolvată' as RequestStatus, date: '27 Apr 2026' },
  { id: 'req-4', title: 'Ușă intrare defectă', apartment: 'Bloc principal', category: 'Securitate', priority: 'urgentă' as RequestPriority, status: 'nouă' as RequestStatus, date: '29 Apr 2026' },
];

const statusVariant: Record<RequestStatus, 'default' | 'warning' | 'success'> = {
  nouă: 'default',
  'în lucru': 'warning',
  rezolvată: 'success',
};

const priorityVariant: Record<RequestPriority, 'neutral' | 'warning' | 'error'> = {
  normală: 'neutral',
  importantă: 'warning',
  urgentă: 'error',
};

export default function AdminIssuesPage() {
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('toate');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((item) => {
      const matchesQuery = !needle || `${item.title} ${item.apartment} ${item.category}`.toLowerCase().includes(needle);
      const matchesStatus = status === 'toate' || item.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, requests, status]);

  const updateStatus = (id: string, nextStatus: RequestStatus) => {
    setRequests((current) => current.map((item) => item.id === id ? { ...item, status: nextStatus } : item));
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Cereri" description="Solicitări și intervenții pentru apartamente și spații comune." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cereri totale" value={requests.length} description="În evidență" icon={<Wrench className="h-5 w-5" />} />
        <StatCard label="Noi" value={requests.filter((item) => item.status === 'nouă').length} description="Nealocate" icon={<AlertCircle className="h-5 w-5" />} tone="warning" />
        <StatCard label="În lucru" value={requests.filter((item) => item.status === 'în lucru').length} description="Urmărite activ" icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Rezolvate" value={requests.filter((item) => item.status === 'rezolvată').length} description="Închise recent" icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </section>
      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută cerere, apartament sau categorie" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="h-11 rounded-2xl border border-border/70 bg-white px-3 text-sm outline-none" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="toate">Toate statusurile</option>
            <option value="nouă">Nouă</option>
            <option value="în lucru">În lucru</option>
            <option value="rezolvată">Rezolvată</option>
          </select>
        </div>
      </Card>
      <section className="grid gap-3">
        {filtered.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">{request.title}</h2>
                  <Badge variant={priorityVariant[request.priority]}>{request.priority}</Badge>
                  <Badge variant={statusVariant[request.status]}>{request.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{request.apartment} · {request.category} · {request.date}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => updateStatus(request.id, 'în lucru')}>În lucru</Button>
                <Button size="sm" variant="secondary" onClick={() => updateStatus(request.id, 'rezolvată')}>Rezolvată</Button>
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
