'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, Building2, Users, Zap } from 'lucide-react';

const plans = [
  {
    name: 'Start',
    price: 'Gratuit',
    period: '30 zile',
    description: 'Perfect pentru a testa platforma și a vedea cum funcționează.',
    features: [
      'Până la 50 apartamente',
      'Gestiune contoare',
      'Avizier digital',
      'Suport email',
    ],
    cta: 'Începe gratuit',
    href: '/demo-request',
    featured: false,
    icon: Building2,
  },
  {
    name: 'Profesional',
    price: '299',
    period: 'MDL / lună',
    description: 'Pentru asociații care vor să automatizeze complet administrarea.',
    features: [
      'Apartamente nelimitate',
      'Toate funcționalitățile',
      'Aplicație mobil locatari',
      'Rapoarte avansate',
      'Suport prioritar',
      'Import date Excel',
    ],
    cta: 'Contactează-ne',
    href: '/demo-request',
    featured: true,
    icon: Zap,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'preț personalizat',
    description: 'Pentru administrații mari cu nevoi specifice de integrare.',
    features: [
      'Tot din Profesional',
      'Integrări personalizate',
      'API access',
      'SLA garantat',
      'Manager dedicat',
      'Training echipă',
    ],
    cta: 'Contactează vânzări',
    href: '/contact',
    featured: false,
    icon: Users,
  },
];

export default function PricingPage() {
  const t = useTranslations('marketing.pricingPage');
  
  return (
    <MarketingLayout>
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
              Prețuri
            </p>
            <h1 className="mt-3 text-4xl font-bold text-gray-900 sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('subtitle')}
            </p>
          </div>

          {/* Pricing cards */}
          <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <article
                  key={plan.name}
                  className={`relative overflow-hidden rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    plan.featured
                      ? 'border-teal-200 bg-gradient-to-b from-teal-50 to-white shadow-lg shadow-teal-100/50'
                      : 'border-gray-200 bg-white shadow-sm hover:shadow-gray-200/50'
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -right-12 top-6 rotate-45 bg-teal-600 px-12 py-1 text-xs font-semibold text-white">
                      Popular
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-lg ${
                      plan.featured 
                        ? 'bg-teal-600 shadow-teal-600/20' 
                        : 'bg-gray-900'
                    }`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    </div>
                  </div>

                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.price !== 'Custom' && plan.price !== 'Gratuit' && (
                      <span className="ml-1 text-gray-500">MDL</span>
                    )}
                    <p className="text-sm text-gray-500">{plan.period}</p>
                  </div>

                  <p className="mt-4 text-sm text-gray-600">{plan.description}</p>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-gray-600">
                        <Check className={`h-5 w-5 flex-shrink-0 ${plan.featured ? 'text-teal-600' : 'text-gray-400'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`mt-8 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition ${
                      plan.featured
                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              );
            })}
          </div>

          {/* FAQ or additional info */}
          <div className="mx-auto mt-20 max-w-2xl text-center">
            <p className="text-gray-600">
              Aveți întrebări despre prețuri?{' '}
              <Link href="/contact" className="font-semibold text-teal-600 hover:text-teal-700">
                Contactați-ne
              </Link>
              {' '}și vă vom răspunde în cel mai scurt timp.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
