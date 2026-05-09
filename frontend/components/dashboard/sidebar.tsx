'use client';

import {
  Home,
  Building,
  CreditCard,
  FileText,
  AlertCircle,
  Bell,
  Gauge,
  Settings,
  Users,
} from 'lucide-react';

const menu = [
  { name: 'Acasă', icon: Home },
  { name: 'Apartamente', icon: Building },
  { name: 'Locatari', icon: Users },
  { name: 'Contoare', icon: Gauge },
  { name: 'Facturi', icon: FileText },
  { name: 'Plăți', icon: CreditCard },
  { name: 'Cereri', icon: AlertCircle },
  { name: 'Avizier', icon: Bell },
  { name: 'Setări', icon: Settings },
];

export function Sidebar({ collapsed: _collapsed, onToggle: _onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col justify-between border-r border-gray-200 bg-white p-4">
      <div>
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
            C
          </div>
          <span className="text-lg font-semibold text-gray-900">Espace</span>
        </div>

        <div className="space-y-1">
          {menu.map((item, index) => (
            <div
              key={index}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <item.icon className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
        <div className="h-10 w-10 rounded-full bg-gray-300" />
        <div>
          <p className="text-sm font-medium text-gray-900">Igor</p>
          <p className="text-xs text-gray-500">Administrator</p>
        </div>
      </div>
    </div>
  );
}
