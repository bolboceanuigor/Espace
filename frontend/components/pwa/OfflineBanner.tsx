'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOffline = () => {
      setRestored(false);
      setOnline(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setRestored(true);
      window.setTimeout(() => setRestored(false), 2600);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (online && !restored) return null;

  return (
    <div
      className={`sticky top-0 z-50 flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-center text-sm font-semibold ${
        online ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'
      }`}
      role="status"
    >
      <WifiOff className="h-4 w-4" />
      {online ? 'Conexiunea a revenit.' : 'Ești offline. Poți vedea doar informațiile deja încărcate.'}
    </div>
  );
}
