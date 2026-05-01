'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
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
  ArrowRight,
  Check,
  Home,
  Receipt,
  Droplets,
  AlertCircle,
  Sparkles,
  Zap,
  Globe,
  Lock,
  ChevronRight,
  Play,
  Star,
} from 'lucide-react';

export default function LandingPageContent() {
  const [activeTab, setActiveTab] = useState<'superadmin' | 'admin' | 'resident'>('admin');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-[#00d4aa] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-[#7c3aed] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#ec4899] rounded-full mix-blend-multiply filter blur-[128px] opacity-15 animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Noise overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%270 0 400 400%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noiseFilter%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noiseFilter)%27/%3E%3C/svg%3E')] opacity-[0.02] pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c3aed] opacity-80" />
              <Building2 className="relative h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Espace</span>
          </div>
          
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Functionalitati</a>
            <a href="#preview" className="text-sm text-white/60 hover:text-white transition-colors">Preview</a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Preturi</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-white/70 hover:text-white transition-colors">
              Autentificare
            </Link>
            <Link href="/demo" className="group relative inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              Cere Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className={`mx-auto max-w-4xl text-center ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/70 mb-8">
              <Sparkles className="h-4 w-4 text-[#00d4aa]" />
              Platforma #1 pentru administrare imobiliara
            </div>
            
            {/* Main headline */}
            <h1 className="text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">
              <span className="block text-white">Administrare</span>
              <span className="animated-gradient-text">fara compromisuri</span>
            </h1>
            
            <p className="mt-8 text-lg text-white/50 md:text-xl max-w-2xl mx-auto leading-relaxed">
              Platforma moderna pentru asociatii de proprietari. 
              Gestioneaza apartamente, plati si comunicari intr-un singur loc.
            </p>
            
            {/* CTA Buttons */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link href="/register" className="btn-primary">
                Incepe gratuit
                <ChevronRight className="h-5 w-5" />
              </Link>
              <Link href="/demo" className="btn-secondary">
                <Play className="h-4 w-4" />
                Vezi demo
              </Link>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-16 flex items-center justify-center gap-8 text-white/40">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span className="text-sm">Date securizate</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                <span className="text-sm">Setup in 5 minute</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <span className="text-sm">500+ asociatii</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <div className="w-1 h-2 rounded-full bg-white/40 animate-bounce" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-24 border-y border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: '500+', label: 'Asociatii Active', icon: Building2 },
              { value: '15,000+', label: 'Apartamente', icon: Home },
              { value: '99.9%', label: 'Uptime Garantat', icon: Zap },
              { value: '4.9/5', label: 'Rating Clienti', icon: Star },
            ].map((stat, i) => (
              <div key={stat.label} className="group text-center card-hover rounded-2xl p-6 border border-transparent hover:border-white/10 hover:bg-white/[0.02]">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00d4aa]/20 to-[#7c3aed]/20 mb-4">
                  <stat.icon className="h-6 w-6 text-[#00d4aa]" />
                </div>
                <div className="text-4xl font-bold text-white md:text-5xl">{stat.value}</div>
                <div className="mt-2 text-sm text-white/50">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold md:text-5xl">
              Tot ce ai nevoie,
              <span className="animated-gradient-text"> intr-un singur loc</span>
            </h2>
            <p className="mt-4 text-lg text-white/50 max-w-2xl mx-auto">
              Functionalitati complete pentru administratori si locatari
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { 
                icon: Building2, 
                title: 'Evidenta Apartamente', 
                desc: 'Structura completa pe bloc, scara si apartament cu istoric complet.',
                gradient: 'from-[#00d4aa] to-[#00a884]',
                size: 'lg:col-span-1'
              },
              { 
                icon: CreditCard, 
                title: 'Plati si Datorii', 
                desc: 'Urmaresti solduri, incasari si restante in timp real. Notificari automate.',
                gradient: 'from-[#7c3aed] to-[#5b21b6]',
                size: 'lg:col-span-1'
              },
              { 
                icon: Gauge, 
                title: 'Citiri Contoare', 
                desc: 'Locatarii transmit citirile online, tu le validezi instant.',
                gradient: 'from-[#ec4899] to-[#be185d]',
                size: 'lg:col-span-1'
              },
              { 
                icon: ClipboardList, 
                title: 'Sesizari', 
                desc: 'Flux complet de la raportare pana la rezolvare cu tracking.',
                gradient: 'from-[#f59e0b] to-[#d97706]',
                size: 'lg:col-span-1'
              },
              { 
                icon: Bell, 
                title: 'Anunturi', 
                desc: 'Comunici rapid cu toti locatarii prin notificari push si email.',
                gradient: 'from-[#06b6d4] to-[#0891b2]',
                size: 'lg:col-span-1'
              },
              { 
                icon: FileBarChart2, 
                title: 'Rapoarte', 
                desc: 'Situatii financiare si operationale exportabile in PDF/Excel.',
                gradient: 'from-[#8b5cf6] to-[#6d28d9]',
                size: 'lg:col-span-1'
              },
            ].map((feature) => (
              <div 
                key={feature.title} 
                className={`group relative rounded-2xl border border-white/5 bg-white/[0.02] p-8 card-hover overflow-hidden ${feature.size}`}
              >
                {/* Gradient glow on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient}`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-white/50 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section id="preview" className="py-24 border-y border-white/5">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold md:text-5xl">
              3 interfete,
              <span className="animated-gradient-text"> o singura platforma</span>
            </h2>
            <p className="mt-4 text-lg text-white/50">
              Experiente optimizate pentru fiecare tip de utilizator
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1.5">
              {[
                { key: 'superadmin', label: 'Superadmin', icon: Shield },
                { key: 'admin', label: 'Administrator', icon: Users },
                { key: 'resident', label: 'Locatar', icon: Home },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-all duration-300 ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-[#00d4aa] to-[#00a884] text-black shadow-[0_0_30px_rgba(0,212,170,0.3)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Content */}
          <div className="relative">
            {/* Glow effect behind preview */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#00d4aa]/10 via-transparent to-[#7c3aed]/10 rounded-3xl blur-3xl opacity-30" />
            
            <div className="relative rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl overflow-hidden">
              {activeTab === 'superadmin' && (
                <div className="p-8">
                  <div className="mb-8">
                    <div className="inline-flex items-center gap-2 text-[#00d4aa] text-sm font-medium mb-2">
                      <Shield className="h-4 w-4" />
                      SUPERADMIN DASHBOARD
                    </div>
                    <h3 className="text-2xl font-bold">Administreaza toate asociatiile</h3>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: 'Asociatii Active', value: '127', trend: '+12%', color: 'from-[#00d4aa] to-[#00a884]' },
                      { label: 'Total Apartamente', value: '4,892', trend: '+8%', color: 'from-[#7c3aed] to-[#5b21b6]' },
                      { label: 'Rata Plati', value: '98%', trend: '+2%', color: 'from-[#ec4899] to-[#be185d]' },
                      { label: 'Venituri Luna', value: '45.2K MDL', trend: '+15%', color: 'from-[#f59e0b] to-[#d97706]' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-white/50 text-sm">{stat.label}</span>
                          <span className="text-[#00d4aa] text-xs font-medium">{stat.trend}</span>
                        </div>
                        <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                    <h4 className="text-sm font-semibold text-white/70 mb-4">Asociatii Recente</h4>
                    <div className="space-y-3">
                      {[
                        { name: 'Bloc A1 - Centru', status: 'Activ', apartments: 48 },
                        { name: 'Bloc B3 - Rascani', status: 'Activ', apartments: 64 },
                        { name: 'Bloc C7 - Botanica', status: 'Trial', apartments: 32 },
                      ].map((assoc) => (
                        <div key={assoc.name} className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#00d4aa]/20 to-[#7c3aed]/20 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-[#00d4aa]" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white">{assoc.name}</span>
                              <span className="block text-xs text-white/40">{assoc.apartments} apartamente</span>
                            </div>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            assoc.status === 'Activ' 
                              ? 'bg-[#00d4aa]/10 text-[#00d4aa]' 
                              : 'bg-[#7c3aed]/10 text-[#7c3aed]'
                          }`}>
                            {assoc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'admin' && (
                <div className="flex">
                  {/* Sidebar */}
                  <div className="hidden w-64 border-r border-white/5 bg-white/[0.01] p-6 md:block">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c3aed]" />
                      <div>
                        <span className="block text-sm font-semibold">Bloc A1</span>
                        <span className="text-xs text-white/40">48 apartamente</span>
                      </div>
                    </div>
                    <nav className="space-y-1">
                      {[
                        { name: 'Dashboard', active: true },
                        { name: 'Apartamente', active: false },
                        { name: 'Plati', active: false },
                        { name: 'Contoare', active: false },
                        { name: 'Sesizari', active: false },
                        { name: 'Anunturi', active: false },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                            item.active 
                              ? 'bg-gradient-to-r from-[#00d4aa]/10 to-transparent text-[#00d4aa] border-l-2 border-[#00d4aa]' 
                              : 'text-white/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {item.name}
                        </div>
                      ))}
                    </nav>
                  </div>
                  
                  {/* Main content */}
                  <div className="flex-1 p-8">
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold">Dashboard</h3>
                      <p className="text-white/40 text-sm">Rezumat pentru Mai 2026</p>
                    </div>
                    
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: 'Apartamente', value: '48', sub: '45 ocupate', color: 'border-[#00d4aa]' },
                        { label: 'Datorii', value: '12.4K MDL', sub: '8 restantieri', color: 'border-[#ef4444]' },
                        { label: 'Citiri Luna', value: '85%', sub: '41/48 transmise', color: 'border-[#7c3aed]' },
                        { label: 'Sesizari', value: '3', sub: '1 urgenta', color: 'border-[#f59e0b]' },
                      ].map((card) => (
                        <div key={card.label} className={`rounded-2xl border-l-4 ${card.color} bg-white/[0.02] border-y border-r border-white/5 p-5`}>
                          <div className="text-2xl font-bold">{card.value}</div>
                          <div className="text-sm font-medium text-white/70">{card.label}</div>
                          <div className="mt-1 text-xs text-white/40">{card.sub}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                      <h4 className="text-sm font-semibold text-white/70 mb-4">Activitate Recenta</h4>
                      <div className="space-y-3 text-sm">
                        {[
                          { text: 'Plata 350 MDL - Apt. 12', color: 'bg-[#00d4aa]', time: 'Acum 5 min' },
                          { text: 'Citire contor - Apt. 8', color: 'bg-[#7c3aed]', time: 'Acum 15 min' },
                          { text: 'Sesizare noua - Apt. 15', color: 'bg-[#f59e0b]', time: 'Acum 1 ora' },
                        ].map((activity, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className={`h-2 w-2 rounded-full ${activity.color}`} />
                              <span className="text-white/70">{activity.text}</span>
                            </div>
                            <span className="text-white/30 text-xs">{activity.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'resident' && (
                <div className="flex items-center justify-center p-12">
                  <div className="w-full max-w-sm">
                    {/* Phone mockup */}
                    <div className="rounded-[2.5rem] border-4 border-white/10 bg-black p-3 shadow-2xl">
                      <div className="rounded-[2rem] overflow-hidden bg-gradient-to-b from-zinc-900 to-black">
                        {/* Status bar */}
                        <div className="flex items-center justify-between px-6 py-2 text-xs text-white/60">
                          <span>9:41</span>
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-2 rounded-sm border border-white/60" />
                          </div>
                        </div>
                        
                        {/* App header */}
                        <div className="bg-gradient-to-br from-[#00d4aa] to-[#7c3aed] px-6 pt-6 pb-8">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <div className="text-white/70 text-sm">Bine ai venit,</div>
                              <div className="text-white font-semibold text-lg">Ion Popescu</div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                              <Users className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          
                          <div className="rounded-2xl bg-black/20 backdrop-blur-xl p-5">
                            <div className="text-white/70 text-sm">Sold curent</div>
                            <div className="text-white font-bold text-3xl mt-1">450 MDL</div>
                            <button className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-black">
                              Achita acum
                            </button>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="px-6 py-6 space-y-6">
                          {/* Alert */}
                          <div className="rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-4">
                            <div className="flex items-center gap-2 text-[#f59e0b] text-sm font-medium">
                              <AlertCircle className="h-4 w-4" />
                              Transmite citirea pana pe 25 Mai
                            </div>
                          </div>
                          
                          {/* Quick actions */}
                          <div>
                            <h4 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Actiuni rapide</h4>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { icon: Droplets, label: 'Contoare', color: 'from-[#06b6d4] to-[#0891b2]' },
                                { icon: Receipt, label: 'Facturi', color: 'from-[#00d4aa] to-[#00a884]' },
                                { icon: ClipboardList, label: 'Sesizari', color: 'from-[#f59e0b] to-[#d97706]' },
                                { icon: MessageSquare, label: 'Mesaje', color: 'from-[#7c3aed] to-[#5b21b6]' },
                              ].map((action) => (
                                <div key={action.label} className="flex flex-col items-center rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                  <div className={`rounded-xl bg-gradient-to-br ${action.color} p-3`}>
                                    <action.icon className="h-5 w-5 text-white" />
                                  </div>
                                  <span className="mt-2 text-xs font-medium text-white/70">{action.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold md:text-5xl">
              Preturi simple,
              <span className="animated-gradient-text"> fara surprize</span>
            </h2>
            <p className="mt-4 text-lg text-white/50">
              Alege planul potrivit pentru asociatia ta
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '99',
                desc: 'Pentru asociatii mici',
                features: ['Pana la 30 apartamente', 'Evidenta plati', 'Citiri contoare', 'Suport email'],
                gradient: 'from-zinc-800 to-zinc-900',
                border: 'border-white/5',
              },
              {
                name: 'Professional',
                price: '249',
                desc: 'Cel mai popular',
                featured: true,
                features: ['Pana la 100 apartamente', 'Toate functionalitatile', 'Rapoarte avansate', 'Suport prioritar', 'Portal locatari'],
                gradient: 'from-[#00d4aa] to-[#7c3aed]',
                border: 'border-[#00d4aa]/50',
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                desc: 'Pentru grupuri de blocuri',
                features: ['Apartamente nelimitate', 'Multi-asociatie', 'API access', 'Manager dedicat', 'SLA garantat'],
                gradient: 'from-zinc-800 to-zinc-900',
                border: 'border-white/5',
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative group rounded-3xl border ${plan.border} overflow-hidden ${
                  plan.featured ? 'glow-cyan' : ''
                }`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-b ${plan.gradient} ${plan.featured ? 'opacity-100' : 'opacity-50'}`} />
                
                <div className="relative p-8">
                  {plan.featured && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-black/30 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white mb-4">
                      <Star className="h-3 w-3" />
                      Recomandat
                    </div>
                  )}
                  
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <p className="text-white/60 text-sm mt-1">{plan.desc}</p>
                  
                  <div className="mt-6">
                    <span className="text-5xl font-bold text-white">
                      {plan.price === 'Custom' ? plan.price : plan.price}
                    </span>
                    {plan.price !== 'Custom' && (
                      <span className="text-white/60 ml-1">MDL/luna</span>
                    )}
                  </div>
                  
                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm">
                        <div className={`rounded-full p-1 ${plan.featured ? 'bg-black/30' : 'bg-white/10'}`}>
                          <Check className="h-3 w-3 text-[#00d4aa]" />
                        </div>
                        <span className="text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    className={`mt-8 w-full rounded-xl py-3.5 text-sm font-semibold transition-all ${
                      plan.featured
                        ? 'bg-black text-white hover:bg-black/80'
                        : 'bg-white text-black hover:bg-white/90'
                    }`}
                  >
                    {plan.price === 'Custom' ? 'Contacteaza-ne' : 'Incepe acum'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-white/5">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold md:text-5xl">
            Pregatit sa
            <span className="animated-gradient-text"> modernizezi</span>
            <br />administrarea?
          </h2>
          <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto">
            Incepe gratuit si descopera cum Espace poate transforma modul in care iti administrezi asociatia.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register" className="btn-primary">
              Incepe gratuit
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/demo" className="btn-secondary">
              Programeaza demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c3aed] opacity-80" />
                <Building2 className="relative h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Espace</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <a href="#" className="hover:text-white transition-colors">Termeni</a>
              <a href="#" className="hover:text-white transition-colors">Confidentialitate</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="text-sm text-white/30">
              2026 Espace. Toate drepturile rezervate.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
