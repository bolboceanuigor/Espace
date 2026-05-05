'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getToken, getUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { reservationsApi, propertiesApi } from '@/lib/api';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

type Reservation = {
  id: string;
  propertyId: string;
  guestName: string;
  checkOut: string;
  status?: string;
  cleaningStatus: string;
  property?: { id: string; name: string };
};

const CLEANING_STATUSES = ['TODO', 'DONE', 'CANCELLED'];

export default function CleaningPage() {
  const router = useRouter();
  const user = getUser();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [resRes, propRes] = await Promise.all([
        reservationsApi.getAll(),
        propertiesApi.getAll(),
      ]);
      setReservations(resRes.data?.items ?? []);
      setProperties(propRes.data ?? []);
    } catch {
      router.replace('/');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.push('/');
      return;
    }
    void fetchData();
  }, [fetchData, router]);

  const today = useMemo(() => new Date(), []);
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const todaysCheckOuts = useMemo(() => {
    return reservations
      .filter((r) => {
        const out = parseISO(r.checkOut);
        return out >= todayStart && out <= todayEnd && (r.status || '').toLowerCase() !== 'cancelled';
      })
      .map((r) => ({
        ...r,
        propertyName: properties.find((p) => p.id === r.propertyId)?.name ?? '—',
      }))
      .sort((a, b) => new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime());
  }, [reservations, properties, todayStart, todayEnd]);

  const pendingCleanings = useMemo(() => {
    return reservations
      .filter((r) => {
        const out = parseISO(r.checkOut);
        const status = (r.cleaningStatus || 'TODO').toUpperCase();
        const isPast = out < today;
        return (r.status || '').toLowerCase() !== 'cancelled' && isPast && status === 'TODO';
      })
      .map((r) => ({
        ...r,
        propertyName: properties.find((p) => p.id === r.propertyId)?.name ?? '—',
      }))
      .sort((a, b) => new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime());
  }, [reservations, properties, today]);

  const handleStatusChange = async (id: string, cleaningStatus: string) => {
    setUpdating(id);
    try {
      await reservationsApi.update(id, { cleaningStatus });
      setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, cleaningStatus } : r)));
    } finally {
      setUpdating(null);
    }
  };

  const normalizeStatus = (s: string) => {
    const t = (s || 'TODO').toUpperCase();
    return t;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-50 rounded-2xl animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-800">Cleaning</h1>
          <p className="text-sm text-gray-500 mt-1">Today’s check-outs and pending cleanings</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Today’s check-outs</h2>
            <p className="text-sm text-gray-500 mt-0.5">Check-out date is today</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Guest</th>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Check-out</th>
                  <th className="px-6 py-3">Cleaning status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {todaysCheckOuts.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">No check-outs today</td></tr>
                ) : (
                  todaysCheckOuts.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-gray-900">{r.guestName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{r.propertyName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(r.checkOut), 'MMM d, HH:mm')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          normalizeStatus(r.cleaningStatus) === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                          normalizeStatus(r.cleaningStatus) === 'CANCELLED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {normalizeStatus(r.cleaningStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={normalizeStatus(r.cleaningStatus)}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          disabled={updating === r.id}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          {CLEANING_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Pending cleanings</h2>
            <p className="text-sm text-gray-500 mt-0.5">Check-out passed, cleaning not done</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Guest</th>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Check-out</th>
                  <th className="px-6 py-3">Cleaning status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingCleanings.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 text-sm">No pending cleanings</td></tr>
                ) : (
                  pendingCleanings.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-gray-900">{r.guestName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{r.propertyName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{format(parseISO(r.checkOut), 'MMM d, yyyy')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          normalizeStatus(r.cleaningStatus) === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                          normalizeStatus(r.cleaningStatus) === 'CANCELLED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {normalizeStatus(r.cleaningStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={normalizeStatus(r.cleaningStatus)}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          disabled={updating === r.id}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                          {CLEANING_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
