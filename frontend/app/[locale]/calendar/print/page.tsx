'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { calendarApi } from '@/lib/api';
import { addDays, diffDays, toDateOnlyString } from '@/lib/date';

type PropertyItem = { id: string; name: string; code?: string | null };
type ReservationItem = {
  id: string;
  propertyId: string;
  guestName: string;
  startDate: string;
  endDate: string;
  status: string;
};

export default function CalendarPrintPage() {
  const searchParams = useSearchParams();
  const start = searchParams.get('start') || toDateOnlyString(new Date());
  const end = searchParams.get('end') || addDays(start, 40);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);

  useEffect(() => {
    calendarApi
      .getCalendar(start, end)
      .then((res) => {
        setProperties(res.data?.properties ?? []);
        setReservations(res.data?.reservations ?? []);
      })
      .catch(() => {
        setProperties([]);
        setReservations([]);
      });
  }, [end, start]);

  const days = useMemo(() => {
    const count = Math.max(1, diffDays(start, end));
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [end, start]);

  return (
    <main className="p-6 print:p-2">
      <h1 className="mb-2 text-lg font-semibold">Calendar Print</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {start} - {end}
      </p>
      <div className="overflow-auto rounded-xl border border-border/60">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background p-2 text-left">Property</th>
              {days.map((day) => (
                <th key={day} className="p-2">
                  {day.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id} className="border-t border-border/60">
                <td className="sticky left-0 bg-background p-2 font-medium">
                  {property.name}
                </td>
                {days.map((day) => {
                  const hit = reservations.find(
                    (reservation) =>
                      reservation.propertyId === property.id &&
                      reservation.startDate <= day &&
                      reservation.endDate > day,
                  );
                  return (
                    <td key={`${property.id}-${day}`} className="p-2 text-center">
                      {hit ? '■' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
