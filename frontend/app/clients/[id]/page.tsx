'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getToken, getUser } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { clientsApi } from '@/lib/api';
import { format } from 'date-fns';

interface Reservation {
  id: string;
  guestName: string;
  phoneNumber: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: string;
  property?: { id: string; name: string };
}

interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { reservations: number };
  reservations: Reservation[];
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }
    if (!id) return;
    (async () => {
      try {
        const res = await clientsApi.getOne(id);
        setClient(res.data);
      } catch (err) {
        console.error('Failed to fetch client', err);
        setError('Failed to load client.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[300px] text-gray-600">
          Loading...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !client) {
    return (
      <DashboardLayout>
        <div className="mb-6">
          <Link
            href="/clients"
            className="text-sm font-medium text-fresha-azure hover:text-[#0266CC]"
          >
            ← Back to Clients
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center text-gray-600">
          {error ?? 'Client not found.'}
        </div>
      </DashboardLayout>
    );
  }

  const user = getUser();
  const canSeeRevenue = user?.role !== 'cleaner';
  const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ') || '—';
  const totalStays = client.reservations?.length ?? 0;
  const totalRevenue = (client.reservations ?? []).reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link
          href="/clients"
          className="text-sm font-medium text-fresha-azure hover:text-[#0266CC]"
        >
          ← Back to Clients
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Client info</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{fullName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{client.phone}</dd>
              </div>
              {client.email && (
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{client.email}</dd>
                </div>
              )}
              {client.notes && (
                <div>
                  <dt className="text-gray-500">Notes</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{client.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total stays</dt>
                <dd className="font-medium text-gray-900">{totalStays}</dd>
              </div>
              {canSeeRevenue && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total revenue</dt>
                  <dd className="font-medium text-gray-900">{totalRevenue.toFixed(2)}€</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Reservations</h2>
              <p className="text-sm text-gray-500 mt-1">
                {totalStays} reservation{totalStays !== 1 ? 's' : ''}
              </p>
            </div>
            {totalStays === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No reservations linked to this client yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Check-in
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Check-out
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(client.reservations ?? []).map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {res.property?.name ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {res.checkIn ? format(new Date(res.checkIn), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {res.checkOut ? format(new Date(res.checkOut), 'dd MMM yyyy') : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {res.totalPrice != null ? `${res.totalPrice.toFixed(2)}€` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                              (res.status === 'confirmed' || res.status === 'CONFIRMED')
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {res.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
