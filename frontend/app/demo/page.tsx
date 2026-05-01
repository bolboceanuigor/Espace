'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function DemoPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Se pregătește contul demo...');

  useEffect(() => {
    let active = true;
    authApi
      .demoLogin()
      .then(() => {
        if (!active) return;
        setMessage('Redirecționare către dashboard demo...');
        router.replace('/admin');
      })
      .catch(() => {
        if (!active) return;
        setMessage('Nu am putut porni sesiunea demo. Încearcă din nou în câteva secunde.');
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground">{message}</p>
    </div>
  );
}

