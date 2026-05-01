'use client';

import { Building, DollarSign, AlertTriangle, Bell } from 'lucide-react';
import { DashboardMetrics } from './types';

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-[30px] font-semibold leading-8 tracking-tight text-gray-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
          {icon}
        </div>
      </div>
      <div className="mt-5 h-1.5 w-full rounded-full bg-gray-100">
        <div className="h-1.5 w-2/3 rounded-full bg-gray-400" />
      </div>
    </div>
  );
}

export function MetricCards({ metrics: _metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Total Apartamente" value="128" icon={<Building className="h-5 w-5" />} />
      <Metric
        label="Incasari Luna"
        value="45,200 lei"
        icon={<DollarSign className="h-5 w-5" />}
      />
      <Metric label="Datorii Totale" value="12,300 lei" icon={<AlertTriangle className="h-5 w-5" />} />
      <Metric label="Sesizari Active" value="8" icon={<Bell className="h-5 w-5" />} />
    </div>
  );
}
