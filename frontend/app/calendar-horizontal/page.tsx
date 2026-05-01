'use client';

import { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import HorizontalCalendar from '@/components/HorizontalCalendar';
import { getToken, getUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function HorizontalCalendarPage() {
  const router = useRouter();
  const user = getUser();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/');
    }
  }, [router]);

  const isReadOnly = (user?.role || '').toUpperCase() === 'CLEANER';

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-gray-800">Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isReadOnly ? 'Read-only view' : 'Horizontal property calendar — drag to move, click to add'}
        </p>
      </div>
      <HorizontalCalendar readOnly={isReadOnly} />
    </DashboardLayout>
  );
}
