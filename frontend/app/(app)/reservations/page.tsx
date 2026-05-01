'use client';

import { useEffect, useMemo, useState } from 'react';
import { addMonths, format, startOfMonth } from 'date-fns';
import { useLocale, useTranslations } from 'next-intl';
import { exportsApi, propertiesApi, reservationsApi } from '@/lib/api';
import { Button, Modal, ModalBody, ModalFooter, ModalHeader, PageHeader, StatusBadge, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, parseDateOnly, toDateOnlyString } from '@/lib/date';
import { formatDate } from '@/lib/formatDate';

type Property = { id: string; name: string };
type Reservation = {
  id: string;
  propertyId: string;
  property?: { name?: string | null };
  guestName: string;
  phoneNumber?: string | null;
  status: string;
  source?: string | null;
  notes?: string | null;
  checkIn?: string;
  checkOut?: string;
  startDate?: string;
  endDate?: string;
};

const EMPTY_FORM = {
  propertyId: '',
  guestName: '',
  phoneNumber: '',
  checkIn: '',
  checkOut: '',
  status: 'CONFIRMED',
  source: 'DIRECT',
  notes: '',
};

export default function ReservationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const tPages = useTranslations('pages.reservations');
  const tActions = useTranslations('actions');
  const tForm = useTranslations('form');
  const tStatus = useTranslations('status');
  const tErrors = useTranslations('errors');
  const c = useTranslations('common');
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';
  const queryFilter = (searchParams.get('query') || '').trim().toLowerCase();

  const [items, setItems] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [startDate, setStartDate] = useState(() => toDateOnlyString(new Date()));
  const [endDate, setEndDate] = useState(() => addDays(toDateOnlyString(new Date()), 14));
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });

  const downloadCsv = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(searchTerm.trim().toLowerCase()),
      280,
    );
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const normalizeCheckIn = (reservation: Reservation) => reservation.checkIn || reservation.startDate || '';
  const normalizeCheckOut = (reservation: Reservation) => reservation.checkOut || reservation.endDate || '';

  const load = async () => {
    setLoading(true);
    try {
      const [reservationsRes, propertiesRes] = await Promise.all([
        reservationsApi.getAll({
          start: startDate,
          end: endDate,
          status: statusFilter,
          source: sourceFilter,
          propertyId: propertyFilter === 'all' ? undefined : propertyFilter,
          q: debouncedSearch || queryFilter || undefined,
          page,
          pageSize: 20,
        }),
        propertiesApi.getAll(),
      ]);
      setItems(reservationsRes.data?.items ?? []);
      setMeta(reservationsRes.data?.meta ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 });
      setProperties((propertiesRes.data ?? []).map((p: any) => ({ id: p.id, name: p.name })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, startDate, endDate, statusFilter, sourceFilter, propertyFilter, debouncedSearch, queryFilter]);

  const filtered = useMemo(() => items, [items]);

  const openCreate = () => {
    setEditing(null);
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    setForm({ ...EMPTY_FORM, checkIn: monthStart, checkOut: monthStart });
    setError('');
    setIsOpen(true);
  };

  const openEdit = (item: Reservation) => {
    setEditing(item);
    setForm({
      propertyId: item.propertyId,
      guestName: item.guestName || '',
      phoneNumber: item.phoneNumber || '',
      checkIn: normalizeCheckIn(item).slice(0, 10),
      checkOut: normalizeCheckOut(item).slice(0, 10),
      status: (item.status || 'CONFIRMED').toUpperCase(),
      source: (item.source || 'DIRECT').toUpperCase(),
      notes: item.notes || '',
    });
    setError('');
    setIsOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        propertyId: form.propertyId,
        guestName: form.guestName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        status: form.status,
        source: form.source,
        notes: form.notes.trim() || undefined,
      };

      if (editing) {
        await reservationsApi.update(editing.id, payload);
      } else {
        await reservationsApi.create({ ...payload, totalPrice: 0 });
      }
      setIsOpen(false);
      await load();
      showToast(c('saved'), 'success');
    } catch (err: any) {
      const message = err.response?.status === 409 ? tErrors('overlap') : (err.response?.data?.message || c('error'));
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(c('deleteConfirm'))) return;
    try {
      await reservationsApi.delete(id);
      await load();
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  const handleExport = async () => {
    try {
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const end = format(startOfMonth(addMonths(new Date(), 1)), 'yyyy-MM-dd');
      const res = await exportsApi.exportReservations(start, end);
      downloadCsv(res.data, 'reservations.csv');
      showToast(c('saved'), 'success');
    } catch {
      showToast(c('error'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={tPages('title')}
        description={tPages('desc')}
        rightSlot={
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button size="sm" variant="secondary" onClick={handleExport}>
                {tActions('export')}
              </Button>
            ) : null}
            {isAdmin ? (
              <Button size="sm" onClick={openCreate}>
                {tActions('add')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-3 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-28px_rgba(109,40,217,0.45)]">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
          />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground"
            placeholder={c('search')}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground">
            <option value="all">All status</option>
            <option value="CONFIRMED">{tStatus('CONFIRMED')}</option>
            <option value="PENDING">{tStatus('PENDING')}</option>
            <option value="CANCELLED">{tStatus('CANCELLED')}</option>
            <option value="BLOCKED">{tStatus('BLOCKED')}</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground">
            <option value="all">All source</option>
            <option value="DIRECT">DIRECT</option>
            <option value="AIRBNB">AIRBNB</option>
            <option value="BOOKING">BOOKING</option>
          </select>
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="h-9 rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground">
            <option value="all">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array.from({ length: 5 })].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : null}
          {!loading && filtered.length === 0 ? <p className="text-sm text-muted-foreground">No reservations.</p> : null}
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/60 px-3 py-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {item.property?.name || properties.find((property) => property.id === item.propertyId)?.name || '-'}
                </p>
                <p className="text-sm font-medium text-foreground">{item.guestName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(locale, parseDateOnly(normalizeCheckIn(item).slice(0, 10)))} - {formatDate(locale, parseDateOnly(normalizeCheckOut(item).slice(0, 10)))}
                </p>
              </div>
              <StatusBadge status={(item.status || 'CONFIRMED').toUpperCase()} />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    router.push(
                      `/${locale}/calendar?start=${startDate}&end=${addDays(startDate, 40)}&highlightReservationId=${item.id}`,
                    )
                  }
                >
                  {tActions('openInCalendar')}
                </Button>
                {isAdmin ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                      {tActions('edit')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleDelete(item.id)}>
                      {tActions('delete')}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {meta.page} / {meta.totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            disabled={page >= meta.totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} maxWidth="lg">
        <ModalHeader title={editing ? tActions('edit') : tActions('add')} onClose={() => setIsOpen(false)} />
        <ModalBody className="space-y-3">
          {error ? <div className="rounded-xl border border-border/60 bg-muted/60 px-3 py-2 text-xs text-foreground">{error}</div> : null}
          <select autoFocus className="select" value={form.propertyId} onChange={(e) => setForm((p) => ({ ...p, propertyId: e.target.value }))}>
            <option value="">{tForm('property')}</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <input className="input" placeholder={tForm('guestName')} value={form.guestName} onChange={(e) => setForm((p) => ({ ...p, guestName: e.target.value }))} />
          <input className="input" placeholder={tForm('phone')} value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="date" value={form.checkIn} onChange={(e) => setForm((p) => ({ ...p, checkIn: e.target.value }))} />
            <input className="input" type="date" value={form.checkOut} onChange={(e) => setForm((p) => ({ ...p, checkOut: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="CONFIRMED">{tStatus('CONFIRMED')}</option>
              <option value="PENDING">{tStatus('PENDING')}</option>
              <option value="CANCELLED">{tStatus('CANCELLED')}</option>
              <option value="BLOCKED">{tStatus('BLOCKED')}</option>
            </select>
            <input className="input" placeholder={tForm('source')} value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} />
          </div>
          <textarea className="input" rows={3} placeholder={tForm('notes')} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            {tActions('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '...' : tActions('save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
