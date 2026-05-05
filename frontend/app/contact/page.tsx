'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import DemoRequestForm from '@/components/marketing/DemoRequestForm';
import { useTranslations } from 'next-intl';
import { Mail, Phone, Clock, MapPin } from 'lucide-react';

const contactDetails = [
  {
    icon: Mail,
    title: 'Email',
    value: 'contact@espace.md',
    description: 'Vă răspundem în 24h',
  },
  {
    icon: Phone,
    title: 'Telefon',
    value: '+373 22 123 456',
    description: 'Luni - Vineri, 9:00 - 18:00',
  },
  {
    icon: Clock,
    title: 'Program',
    value: '9:00 - 18:00',
    description: 'Luni - Vineri',
  },
  {
    icon: MapPin,
    title: 'Adresă',
    value: 'Chișinău, Moldova',
    description: 'Str. Exemplu 123',
  },
];

export default function ContactPage() {
  const t = useTranslations('marketing.contactPage');
  
  return (
    <MarketingLayout>
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-600">
              Contact
            </p>
            <h1 className="mt-3 text-4xl font-bold text-gray-900 sm:text-5xl">
              {t('title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('subtitle')}
            </p>
          </div>

          {/* Content */}
          <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-5">
            {/* Contact details */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900">{t('detailsTitle')}</h2>
              <div className="mt-6 space-y-6">
                {contactDetails.map((detail) => {
                  const Icon = detail.icon;
                  return (
                    <div key={detail.title} className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50">
                        <Icon className="h-6 w-6 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">{detail.title}</p>
                        <p className="mt-1 text-base font-semibold text-gray-900">{detail.value}</p>
                        <p className="text-sm text-gray-500">{detail.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-semibold text-gray-900">{t('formTitle')}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Completează formularul și te vom contacta în cel mai scurt timp.
                </p>
                <div className="mt-6">
                  <DemoRequestForm compact />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
