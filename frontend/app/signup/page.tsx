'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">E</span>
            </div>
          </div>
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-gray-800">Espace</h1>
          <p className="mt-2 text-gray-600">Înregistrarea publică este dezactivată.</p>
          <p className="text-sm text-gray-500">Doar utilizatorii existenți se pot autentifica. Contactează administratorul A.P.C. pentru acces.</p>
        </div>
        <Link
          href="/login"
          prefetch={false}
          className="inline-flex justify-center py-3 px-6 rounded-lg text-sm font-medium text-white bg-black hover:opacity-90"
        >
          Intră în platformă
        </Link>
      </div>
    </div>
  );
}
