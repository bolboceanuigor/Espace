'use client';

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, startOfDay } from 'date-fns';

interface MiniMonthOverviewProps {
  /** Reference date (e.g. current week start or view start) */
  date: Date;
  /** Optional: range start for highlight */
  rangeStart?: Date;
  /** Optional: range end for highlight */
  rangeEnd?: Date;
  className?: string;
}

export default function MiniMonthOverview({ date, rangeStart, rangeEnd, className = '' }: MiniMonthOverviewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      <div className="font-medium text-gray-700 mb-1.5">{format(date, 'MMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="w-4 h-4 text-center text-[10px] text-gray-400 font-medium">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, date);
          const isToday = isSameDay(d, new Date());
          const inRange =
            rangeStart &&
            rangeEnd &&
            startOfDay(d) >= startOfDay(rangeStart) &&
            startOfDay(d) <= startOfDay(rangeEnd);
          return (
            <div
              key={d.toISOString()}
              className={`w-4 h-4 flex items-center justify-center rounded ${
                !inMonth ? 'text-gray-200' : isToday ? 'bg-gray-800 text-white font-semibold' : inRange ? 'bg-gray-100 text-gray-800' : 'text-gray-600'
              }`}
            >
              {format(d, 'd')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
