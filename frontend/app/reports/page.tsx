'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { reservationsApi, propertiesApi } from '@/lib/api';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Reservation = {
  id: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
};

type Property = { id: string; name: string };

function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthsBack, setMonthsBack] = useState(12);

  useEffect(() => {
    if (!getToken()) {
      router.push('/');
      return;
    }
    Promise.all([reservationsApi.getAll(), propertiesApi.getAll()])
      .then(([resRes, propRes]) => {
        setReservations(resRes.data?.items ?? []);
        setProperties(propRes.data ?? []);
      })
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false));
  }, [router]);

  const confirmed = useMemo(
    () => reservations.filter((r) => (r.status || '').toLowerCase() === 'confirmed'),
    [reservations]
  );

  const revenueByMonth = useMemo(() => {
    const now = new Date();
    const out: { month: string; revenue: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const revenue = confirmed
        .filter((r) => {
          const checkIn = parseISO(r.checkIn);
          return checkIn >= start && checkIn <= end;
        })
        .reduce((s, r) => s + (r.totalPrice ?? 0), 0);
      out.push({ month: format(d, 'MMM yy'), revenue: Math.round(revenue * 100) / 100 });
    }
    return out;
  }, [confirmed, monthsBack]);

  const revenueByProperty = useMemo(() => {
    return properties.map((p) => {
      const rev = confirmed
        .filter((r) => r.propertyId === p.id)
        .reduce((s, r) => s + (r.totalPrice ?? 0), 0);
      return { name: p.name, revenue: Math.round(rev * 100) / 100 };
    }).filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  }, [confirmed, properties]);

  const occupancyByMonth = useMemo(() => {
    const now = new Date();
    const propCount = properties.length || 1;
    const out: { month: string; occupancy: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const daysInMonth = eachDayOfInterval({ start, end }).length;
      let occupiedNights = 0;
      confirmed.forEach((r) => {
        const cin = parseISO(r.checkIn);
        const cout = parseISO(r.checkOut);
        eachDayOfInterval({ start, end }).forEach((day) => {
          if (day >= cin && day < cout) occupiedNights++;
        });
      });
      const pct = (propCount * daysInMonth) > 0 ? Math.round((occupiedNights / (propCount * daysInMonth)) * 100) : 0;
      out.push({ month: format(d, 'MMM yy'), occupancy: Math.min(100, pct) });
    }
    return out;
  }, [confirmed, properties.length]);

  const avgStayLength = useMemo(() => {
    if (confirmed.length === 0) return 0;
    const totalNights = confirmed.reduce((s, r) => {
      const cin = parseISO(r.checkIn);
      const cout = parseISO(r.checkOut);
      return s + Math.max(1, differenceInDays(cout, cin));
    }, 0);
    return Math.round((totalNights / confirmed.length) * 10) / 10;
  }, [confirmed]);

  const handleExportCsv = () => {
    const headers = ['Month', 'Revenue'];
    const rows = revenueByMonth.map((r) => [escapeCsvCell(r.month), String(r.revenue)]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `revenue-by-month-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-800">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Revenue and occupancy overview</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(Number(e.target.value))}
              className="rounded-2xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-2xl hover:bg-gray-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Total revenue (period)</h3>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {revenueByMonth.reduce((s, r) => s + r.revenue, 0).toFixed(0)}€
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Average stay length</h3>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{avgStayLength} nights</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">Revenue by month</h3>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value: number) => [`${value}€`, 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="#64748b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue by property</h3>
            <div className="h-64 mt-4">
              {revenueByProperty.length === 0 ? (
                <p className="text-sm text-gray-500">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByProperty} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => [`${value}€`, 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="revenue" fill="#64748b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Occupancy % (last 6 months)</h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Occupancy']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="occupancy" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
