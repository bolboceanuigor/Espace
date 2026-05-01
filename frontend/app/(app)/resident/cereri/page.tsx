'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Droplets,
  Thermometer,
  Zap,
  Wrench,
  ArrowUp,
} from 'lucide-react';

// Mock data
const requests = [
  {
    id: '1',
    title: 'Lift defect - Scara 2',
    category: 'LIFT',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    date: '28 Apr 2026',
    lastUpdate: 'Echipa tehnica a fost notificata.',
  },
  {
    id: '2',
    title: 'Scurgere apa la subsol',
    category: 'APA',
    status: 'NEW',
    priority: 'NORMAL',
    date: '25 Apr 2026',
    lastUpdate: null,
  },
  {
    id: '3',
    title: 'Iluminat hol etaj 6',
    category: 'ELECTRICITATE',
    status: 'RESOLVED',
    priority: 'NORMAL',
    date: '15 Apr 2026',
    lastUpdate: 'Rezolvat pe 18 Apr 2026.',
  },
  {
    id: '4',
    title: 'Calorifer nu incalzeste',
    category: 'INCALZIRE',
    status: 'RESOLVED',
    priority: 'NORMAL',
    date: '10 Mar 2026',
    lastUpdate: 'Aerisit calorifer, problema rezolvata.',
  },
];

const categories = [
  { id: 'APA', label: 'Apa', icon: Droplets, color: 'bg-blue-500/10 text-blue-500' },
  { id: 'INCALZIRE', label: 'Incalzire', icon: Thermometer, color: 'bg-orange-500/10 text-orange-500' },
  { id: 'ELECTRICITATE', label: 'Electricitate', icon: Zap, color: 'bg-yellow-500/10 text-yellow-500' },
  { id: 'LIFT', label: 'Lift', icon: ArrowUp, color: 'bg-purple-500/10 text-purple-500' },
  { id: 'REPARATII', label: 'Reparatii', icon: Wrench, color: 'bg-gray-500/10 text-gray-500' },
];

type TabType = 'all' | 'open' | 'resolved';

export default function ResidentRequestsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const filteredRequests = requests.filter((request) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'open') return request.status === 'NEW' || request.status === 'IN_PROGRESS';
    if (activeTab === 'resolved') return request.status === 'RESOLVED';
    return true;
  });

  const openCount = requests.filter((r) => r.status === 'NEW' || r.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-premium">
        <p className="inline-flex rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          Cereri
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Sesizari si cereri
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trimite sesizari catre administratie.
        </p>
        <Link
          href="/resident/requests/new"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-premium transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Sesizare noua
        </Link>
      </section>

      {/* Summary */}
      {openCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{openCount} cereri deschise</p>
            <p className="text-xs text-muted-foreground">In asteptare sau in lucru</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl border border-border bg-card p-1">
        {[
          { id: 'all' as const, label: 'Toate' },
          { id: 'open' as const, label: 'Deschise' },
          { id: 'resolved' as const, label: 'Rezolvate' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <section className="space-y-3">
        {filteredRequests.map((request) => (
          <RequestCard key={request.id} request={request} categories={categories} />
        ))}
        {filteredRequests.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">Nicio cerere gasita</p>
            <p className="mt-1 text-sm text-muted-foreground">Nu exista cereri in aceasta categorie.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function RequestCard({
  request,
  categories,
}: {
  request: (typeof requests)[0];
  categories: typeof categories;
}) {
  const statusConfig: Record<string, { icon: React.ElementType; label: string; style: string }> = {
    NEW: { icon: Clock, label: 'Noua', style: 'bg-primary/10 text-primary' },
    IN_PROGRESS: { icon: Clock, label: 'In lucru', style: 'bg-warning/10 text-warning' },
    RESOLVED: { icon: CheckCircle2, label: 'Rezolvata', style: 'bg-success/10 text-success' },
  };

  const config = statusConfig[request.status];
  const StatusIcon = config.icon;
  const category = categories.find((c) => c.id === request.category);
  const CategoryIcon = category?.icon || MessageSquare;

  return (
    <Link
      href={`/resident/requests/${request.id}`}
      className="block rounded-2xl border border-border bg-card p-4 shadow-premium transition hover:border-primary/30 hover:shadow-premium-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className={`rounded-xl p-2.5 ${category?.color || 'bg-muted text-muted-foreground'}`}>
            <CategoryIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {request.priority === 'URGENT' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  URGENT
                </span>
              )}
              <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${config.style}`}>
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </span>
            </div>
            <p className="mt-1 font-medium text-foreground">{request.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{request.date}</p>
            {request.lastUpdate && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                {request.lastUpdate}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
