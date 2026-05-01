'use client';

import { Menu, Bell, Search } from 'lucide-react';

export function Header({ onMenuClick, userLabel }: { onMenuClick: () => void; userLabel: string }) {
  return (
    <header className="sticky top-0 z-30 h-[72px] border-b border-gray-200 bg-white px-4 md:px-6 lg:px-8">
      <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="hidden text-sm font-semibold tracking-tight text-gray-900 lg:inline">Dashboard</span>
        </div>
        <div className="relative mx-auto w-full max-w-[760px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Cauta apartament, proprietar..."
            className="h-11 w-full rounded-lg border border-gray-200 bg-gray-100/90 pl-9 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-gray-300 focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-sm font-semibold text-gray-700">
            {userLabel
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join('') || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
