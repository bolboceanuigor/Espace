'use client';

import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/formatDate';
import { addDays } from '@/lib/date';

type CalendarHeaderProps = {
  startDate: string;
  endDate: string; // exclusive
  search: string;
  statusFilter: string;
  sourceFilter: string;
  showCancelled: boolean;
  propertyFilter: string;
  groupFilter: string;
  properties: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onShowCancelledChange: (value: boolean) => void;
  onPropertyFilterChange: (value: string) => void;
  onGroupFilterChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  zoom: 'sm' | 'md' | 'lg';
  onZoomChange: (zoom: 'sm' | 'md' | 'lg') => void;
  onCopyLink: () => void;
  onExportCsv: () => void;
};

export default function CalendarHeader({
  startDate,
  endDate,
  search,
  statusFilter,
  sourceFilter,
  showCancelled,
  propertyFilter,
  groupFilter,
  properties,
  groups,
  onSearchChange,
  onStatusFilterChange,
  onSourceFilterChange,
  onShowCancelledChange,
  onPropertyFilterChange,
  onGroupFilterChange,
  onStartDateChange,
  onEndDateChange,
  onToday,
  onPrev,
  onNext,
  zoom,
  onZoomChange,
  onCopyLink,
  onExportCsv,
}: CalendarHeaderProps) {
  const locale = useLocale();
  const tCalendar = useTranslations('calendar');
  const c = useTranslations('common');
  const tActions = useTranslations('actions');
  const tStatus = useTranslations('status');

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{tCalendar('title')}</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            {formatDate(locale, startDate)} - {formatDate(locale, addDays(endDate, -1))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onPrev} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm text-muted-foreground transition duration-150 ease-out hover:bg-muted/60 hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={onNext} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm text-muted-foreground transition duration-150 ease-out hover:bg-muted/60 hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToday} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition duration-150 ease-out hover:bg-muted/60">
            {tCalendar('today')}
          </button>
          <button type="button" onClick={onCopyLink} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition duration-150 ease-out hover:bg-muted/60">
            {c('copyLink')}
          </button>
          <button type="button" onClick={onExportCsv} className="inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm font-medium text-foreground transition duration-150 ease-out hover:bg-muted/60">
            {tActions('export')}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
        <input
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        />
        <input
          type="date"
          value={addDays(endDate, -1)}
          onChange={(event) => onEndDateChange(event.target.value)}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={c('search')}
            className="h-9 w-full rounded-xl border border-border/60 bg-background py-2 pl-8 pr-3 text-sm text-foreground"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        >
          <option value="all">{c('allStatuses')}</option>
          <option value="confirmed">{tStatus('CONFIRMED')}</option>
          <option value="pending">{tStatus('PENDING')}</option>
          <option value="blocked">{tStatus('BLOCKED')}</option>
        </select>
        <select
          value={groupFilter}
          onChange={(event) => onGroupFilterChange(event.target.value)}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        >
          <option value="all">{c('allGroups')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <select
          value={propertyFilter}
          onChange={(event) => onPropertyFilterChange(event.target.value)}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        >
          <option value="all">{c('allProperties')}</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value)}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        >
          <option value="all">{c('allSources')}</option>
          <option value="DIRECT">DIRECT</option>
          <option value="AIRBNB">AIRBNB</option>
          <option value="BOOKING">BOOKING</option>
        </select>
        <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(event) => onShowCancelledChange(event.target.checked)}
          />
          <span>{c('showCancelled')}</span>
        </label>
        <select
          value={zoom}
          onChange={(event) => onZoomChange(event.target.value as 'sm' | 'md' | 'lg')}
          className="h-9 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
        >
          <option value="sm">{c('zoom')}: S</option>
          <option value="md">{c('zoom')}: M</option>
          <option value="lg">{c('zoom')}: L</option>
        </select>
      </div>
    </div>
  );
}
