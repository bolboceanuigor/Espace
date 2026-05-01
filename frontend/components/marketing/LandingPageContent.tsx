'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Building2,
  CreditCard,
  Bell,
  ClipboardList,
  FileBarChart2,
  Users,
  Gauge,
  MessageSquare,
  Shield,
  ChevronRight,
  Check,
  Home,
  Receipt,
  Droplets,
  AlertCircle,
} from 'lucide-react';

export default function LandingPageContent() {
  const [activeTab, setActiveTab] = useState<'superadmin' | 'admin' | 'resident'>('admin');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Espace</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900">Functionalitati</a>
            <a href="#preview" className="text-sm font-medium text-slate-600 hover:text-slate-900">Preview</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">Preturi</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Autentificare</Link>
            <Link href="/demo" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Cere Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
              Administrare moderna pentru
              <span className="text-blue-600"> asociatii de proprietari</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 md:text-xl">
              Platforma SaaS completa pentru gestionarea apartamentelor, platilor, contoarelor si comunicarii cu locatarii. Fara Excel, fara haos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700">
                Incepe gratuit <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50">
                Vezi demo live
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4">
          {[
            { value: '500+', label: 'Asociatii' },
            { value: '15,000+', label: 'Apartamente' },
            { value: '99.9%', label: 'Uptime' },
            { value: '24/7', label: 'Suport' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-blue-600 md:text-4xl">{stat.value}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Tot ce ai nevoie intr-un singur loc</h2>
            <p className="mt-4 text-lg text-slate-600">Functionalitati complete pentru administratori si locatari</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Building2, title: 'Evidenta Apartamente', desc: 'Structura completa pe bloc, scara si apartament cu date actualizate.', color: 'bg-blue-100 text-blue-600' },
              { icon: CreditCard, title: 'Plati si Datorii', desc: 'Urmaresti solduri, incasari si restante in timp real.', color: 'bg-emerald-100 text-emerald-600' },
              { icon: Gauge, title: 'Citiri Contoare', desc: 'Locatarii transmit citirile, tu le validezi si generezi facturi.', color: 'bg-cyan-100 text-cyan-600' },
              { icon: ClipboardList, title: 'Sesizari', desc: 'Flux complet de la raportare pana la rezolvare.', color: 'bg-amber-100 text-amber-600' },
              { icon: Bell, title: 'Anunturi', desc: 'Comunici rapid cu toti locatarii prin notificari.', color: 'bg-purple-100 text-purple-600' },
              { icon: FileBarChart2, title: 'Rapoarte', desc: 'Situatii financiare si operationale gata de export.', color: 'bg-rose-100 text-rose-600' },
            ].map((feature) => (
              <div key={feature.title} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:shadow-lg">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section id="preview" className="border-y border-slate-200 bg-slate-100 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">3 interfete, o singura platforma</h2>
            <p className="mt-4 text-lg text-slate-600">Experiente optimizate pentru fiecare tip de utilizator</p>
          </div>

          {/* Tabs */}
          <div className="mt-10 flex justify-center">
            <div className="inline-flex rounded-xl bg-white p-1 shadow-sm">
              {[
                { key: 'superadmin', label: 'Superadmin', icon: Shield },
                { key: 'admin', label: 'Administrator', icon: Users },
                { key: 'resident', label: 'Locatar', icon: Home },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Content */}
          <div className="mt-10">
            {activeTab === 'superadmin' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Dashboard Platforma</h3>
                    <p className="text-sm text-slate-500">Administreaza toate asociatiile din platforma</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    { label: 'Asociatii Active', value: '127', color: 'text-blue-600' },
                    { label: 'Total Apartamente', value: '4,892', color: 'text-emerald-600' },
                    { label: 'Abonamente', value: '98%', color: 'text-purple-600' },
                    { label: 'Venituri Luna', value: '45,200 MDL', color: 'text-amber-600' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="mt-1 text-xs text-slate-500">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-slate-200 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Asociatii Recente</h4>
                  <div className="space-y-2">
                    {['Bloc A1 - Centru', 'Bloc B3 - Rascani', 'Bloc C7 - Botanica'].map((name) => (
                      <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-sm text-slate-700">{name}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Activ</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex">
                  {/* Sidebar */}
                  <div className="hidden w-56 border-r border-slate-200 bg-slate-50 p-4 md:block">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-600"></div>
                      <span className="text-sm font-semibold text-slate-900">Bloc A1</span>
                    </div>
                    <nav className="space-y-1">
                      {['Dashboard', 'Apartamente', 'Plati', 'Contoare', 'Sesizari', 'Anunturi'].map((item, i) => (
                        <div
                          key={item}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            i === 0 ? 'bg-blue-100 font-medium text-blue-700' : 'text-slate-600'
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </nav>
                  </div>
                  {/* Main */}
                  <div className="flex-1 p-6">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Dashboard</h3>
                      <p className="text-sm text-slate-500">Rezumat pentru luna Mai 2026</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: 'Apartamente', value: '48', sub: '45 ocupate', color: 'border-blue-500' },
                        { label: 'Datorii Totale', value: '12,450 MDL', sub: '8 restantieri', color: 'border-red-500' },
                        { label: 'Citiri Luna', value: '41/48', sub: '85% completat', color: 'border-emerald-500' },
                        { label: 'Sesizari', value: '3', sub: '1 urgenta', color: 'border-amber-500' },
                      ].map((card) => (
                        <div key={card.label} className={`rounded-xl border-l-4 ${card.color} bg-white p-4 shadow-sm`}>
                          <div className="text-2xl font-bold text-slate-900">{card.value}</div>
                          <div className="text-sm font-medium text-slate-700">{card.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{card.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 rounded-xl border border-slate-200 p-4">
                      <h4 className="mb-3 text-sm font-semibold text-slate-900">Activitate Recenta</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-3 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          Plata 350 MDL - Apt. 12
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                          Citire contor - Apt. 8
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                          Sesizare noua - Apt. 15
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'resident' && (
              <div className="mx-auto max-w-sm">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-xl">
                  {/* Mobile Header */}
                  <div className="rounded-t-3xl bg-blue-600 px-5 py-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm opacity-80">Bine ai venit,</div>
                        <div className="text-lg font-semibold">Ion Popescu</div>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-white/20"></div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white/10 p-4">
                      <div className="text-sm opacity-80">Sold curent</div>
                      <div className="text-3xl font-bold">450 MDL</div>
                      <button className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-blue-600">
                        Achita acum
                      </button>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        Transmite citirea pana pe 25 Mai
                      </div>
                    </div>
                    <h4 className="mb-3 text-sm font-semibold text-slate-900">Actiuni rapide</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: Droplets, label: 'Contoare', color: 'bg-cyan-100 text-cyan-600' },
                        { icon: Receipt, label: 'Facturi', color: 'bg-emerald-100 text-emerald-600' },
                        { icon: ClipboardList, label: 'Sesizari', color: 'bg-amber-100 text-amber-600' },
                        { icon: MessageSquare, label: 'Mesaje', color: 'bg-purple-100 text-purple-600' },
                      ].map((action) => (
                        <div key={action.label} className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className={`rounded-lg p-2 ${action.color}`}>
                            <action.icon className="h-5 w-5" />
                          </div>
                          <span className="mt-2 text-xs font-medium text-slate-700">{action.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Preturi simple si transparente</h2>
            <p className="mt-4 text-lg text-slate-600">Alege planul potrivit pentru asociatia ta</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '99',
                desc: 'Pentru asociatii mici',
                features: ['Pana la 30 apartamente', 'Evidenta plati', 'Citiri contoare', 'Suport email'],
              },
              {
                name: 'Professional',
                price: '249',
                desc: 'Cel mai popular',
                featured: true,
                features: ['Pana la 100 apartamente', 'Toate functionalitatile', 'Rapoarte avansate', 'Suport prioritar', 'Portal locatari'],
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                desc: 'Pentru grupuri de blocuri',
                features: ['Apartamente nelimitate', 'Multi-asociatie', 'API access', 'Manager dedicat', 'SLA garantat'],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.featured
                    ? 'border-blue-600 bg-blue-600 text-white shadow-xl'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <h3 className={`text-lg font-semibold ${plan.featured ? 'text-white' : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${plan.featured ? 'text-blue-100' : 'text-slate-500'}`}>{plan.desc}</p>
                <div className="mt-4">
                  <span className={`text-4xl font-bold ${plan.featured ? 'text-white' : 'text-slate-900'}`}>
                    {plan.price === 'Custom' ? plan.price : `${plan.price} MDL`}
                  </span>
                  {plan.price !== 'Custom' && (
                    <span className={plan.featured ? 'text-blue-100' : 'text-slate-500'}>/luna</span>
                  )}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 ${plan.featured ? 'text-blue-200' : 'text-emerald-500'}`} />
                      <span className={plan.featured ? 'text-white' : 'text-slate-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold ${
                    plan.featured
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {plan.price === 'Custom' ? 'Contacteaza-ne' : 'Incepe acum'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-900 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Pregatit sa modernizezi administrarea?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Incepe gratuit si vezi diferenta in primele 30 de zile.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700">
              Creeaza cont gratuit <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800">
              Programeaza demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-white">Espace</span>
            </div>
            <div className="text-sm text-slate-400">
              © 2026 Espace. Platforma pentru asociatii de proprietari.
            </div>
            <div className="flex gap-4 text-sm text-slate-400">
              <a href="#" className="hover:text-white">Termeni</a>
              <a href="#" className="hover:text-white">Confidentialitate</a>
              <a href="#" className="hover:text-white">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
