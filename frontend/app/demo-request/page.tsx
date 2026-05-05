'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import DemoRequestForm from '@/components/marketing/DemoRequestForm';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';

const benefits = [
  'Prezentare personalizată a platformei',
  'Răspunsuri la toate întrebările tale',
  'Plan de implementare adaptat',
  'Fără obligații sau costuri ascunse',
];

export default function DemoRequestPage() {
  const t = useTranslations('marketing.demoPage');
  
  return (
    <MarketingLayout>
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left - Info */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
                Demo gratuit
              </p>
              <h1 className="mt-3 text-4xl font-bold text-gray-900 sm:text-5xl">
                {t('title')}
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                {t('subtitle')}
              </p>

              <div className="mt-10">
                <p className="text-sm font-semibold text-gray-900">Ce primești:</p>
                <ul className="mt-4 space-y-3">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3 text-gray-600">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-teal-600" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10 rounded-2xl border border-gray-200 bg-gradient-to-br from-teal-50 to-white p-6">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">&ldquo;Espace ne-a simplificat munca enorm.&rdquo;</span>
                  {' '}Acum avem totul într-un singur loc și locatarii sunt mulțumiți.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Maria Popescu</p>
                    <p className="text-xs text-gray-500">Administrator, Bloc Dacia</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Form */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
              <h2 className="text-xl font-semibold text-gray-900">Solicită demo</h2>
              <p className="mt-2 text-sm text-gray-500">
                Completează formularul și te vom contacta pentru a programa o prezentare.
              </p>
              <div className="mt-6">
                <DemoRequestForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
