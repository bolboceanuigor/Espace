'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getToken, getUser } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { propertiesApi } from '@/lib/api';
import PropertyModal from '@/components/PropertyModal';

type Property = {
  id: string;
  name: string;
  address: string;
  basePrice: number;
  cleaningFee: number;
  rooms: number;
  status: string;
  numberOfRooms?: number;
  cleaningPrice?: number;
};

type Stats = { totalRevenue: number; totalBookings: number; occupancyRate: number };

export default function PropertyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const user = getUser();
  const [property, setProperty] = useState<Property | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!getToken() || !id) {
      router.push('/properties');
      return;
    }
    Promise.all([
      propertiesApi.getOne(id),
      propertiesApi.getStats(id).catch(() => ({ data: null })),
    ])
      .then(([propRes, statsRes]) => {
        setProperty(propRes.data);
        setStats(statsRes.data ?? null);
      })
      .catch(() => router.replace('/properties'))
      .finally(() => setLoading(false));
  }, [router, id]);

  const canEdit = (user?.role || '').toUpperCase() === 'OWNER' || (user?.role || '').toUpperCase() === 'MANAGER';

  if (loading || !property) {
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
            <Link href="/properties" className="text-sm text-gray-600 hover:text-gray-800">← Properties</Link>
            <h1 className="text-xl font-semibold tracking-tight text-gray-800 mt-1">{property.name}</h1>
            <p className="text-sm text-gray-500">{property.address}</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:opacity-90"
            >
              Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-500 uppercase">Base price</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{Number(property.basePrice ?? 0).toFixed(0)}€</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-500 uppercase">Cleaning fee</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{Number(property.cleaningFee ?? property.cleaningPrice ?? 0).toFixed(0)}€</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-500 uppercase">Rooms</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{property.rooms ?? property.numberOfRooms ?? 0}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
            <p className="text-xl font-semibold text-gray-900 mt-1 capitalize">{property.status ?? 'active'}</p>
          </div>
        </div>

        {stats && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance (last 365 days)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500">Total revenue</p>
                <p className="text-2xl font-semibold text-gray-900">{Number(stats.totalRevenue).toFixed(0)}€</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bookings</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalBookings}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Occupancy</p>
                <p className="text-2xl font-semibold text-gray-900">{Number(stats.occupancyRate).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Calendar</h2>
          <p className="text-sm text-gray-500">View this property in the calendar to see availability and reservations.</p>
          <Link
            href="/calendar"
            className="mt-3 inline-block px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Open Calendar
          </Link>
        </div>
      </div>

      {editOpen && (
        <PropertyModal
          isOpen={true}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            propertiesApi.getOne(id).then((r) => setProperty(r.data));
          }}
          editProperty={property}
        />
      )}
    </DashboardLayout>
  );
}
