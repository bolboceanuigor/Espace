export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-r from-purple-500/25 to-pink-500/25 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl bg-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-lg">
              E
            </div>
            <span className="text-xl font-semibold">Espace</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition">Functionalitati</a>
            <a href="#" className="hover:text-white transition">Preturi</a>
            <a href="#" className="hover:text-white transition">Despre</a>
          </nav>
          <button className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-sm font-medium hover:opacity-90 transition shadow-lg shadow-cyan-500/25">
            Incepe Gratuit
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Platform SaaS pentru Asociatii
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              Administrare
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Fara Compromisuri
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Platforma completa pentru gestionarea asociatiilor de proprietari. 
            Facturare, contoare, plati online, sesizari - totul intr-un singur loc.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl text-lg font-semibold hover:opacity-90 transition shadow-xl shadow-cyan-500/30 flex items-center gap-2">
              Solicita Demo
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button className="px-8 py-4 rounded-2xl text-lg font-medium border border-white/20 hover:bg-white/10 transition backdrop-blur-sm">
              Vezi Functionalitatile
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-24">
          {[
            { value: '500+', label: 'Asociatii', color: 'from-cyan-400 to-blue-400' },
            { value: '15,000+', label: 'Apartamente', color: 'from-purple-400 to-pink-400' },
            { value: '99.9%', label: 'Uptime', color: 'from-emerald-400 to-cyan-400' },
            { value: '24/7', label: 'Suport', color: 'from-amber-400 to-orange-400' },
          ].map((stat, i) => (
            <div key={i} className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition group">
              <div className={`text-4xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                {stat.value}
              </div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Tot ce ai nevoie</h2>
          <p className="text-gray-400 text-lg">Functionalitatile complete pentru administrarea eficienta</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '🏠', title: 'Evidenta Apartamente', desc: 'Gestioneaza proprietari, locatari si suprafete', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30' },
            { icon: '💳', title: 'Facturare Automata', desc: 'Genereaza si trimite facturi automat lunar', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30' },
            { icon: '📊', title: 'Citiri Contoare', desc: 'Colecteaza citirile de la locatari online', color: 'from-emerald-500/20 to-cyan-500/20', border: 'border-emerald-500/30' },
            { icon: '🔔', title: 'Sesizari & Cereri', desc: 'Primeste si gestioneaza cererile locatarilor', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' },
            { icon: '📢', title: 'Anunturi', desc: 'Comunica rapid cu toti locatarii', color: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-500/30' },
            { icon: '📈', title: 'Rapoarte', desc: 'Analizeaza datele cu rapoarte detaliate', color: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/30' },
          ].map((feature, i) => (
            <div key={i} className={`p-6 rounded-2xl bg-gradient-to-br ${feature.color} border ${feature.border} backdrop-blur-sm hover:scale-[1.02] transition-transform cursor-pointer`}>
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preview Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Trei Interfete, O Platforma</h2>
          <p className="text-gray-400 text-lg">Fiecare utilizator are experienta potrivita</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Superadmin Card */}
          <div className="rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-6 hover:border-cyan-500/40 transition">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Superadmin</h3>
                <p className="text-sm text-gray-400">Platform Owner</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Asociatii active</span>
                <span className="font-semibold text-cyan-400">487</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Venituri luna</span>
                <span className="font-semibold text-emerald-400">124,500 MDL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Utilizatori noi</span>
                <span className="font-semibold text-purple-400">+23</span>
              </div>
            </div>
          </div>

          {/* Admin Card */}
          <div className="rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-6 hover:border-purple-500/40 transition">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Administrator</h3>
                <p className="text-sm text-gray-400">Building Manager</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Apartamente</span>
                <span className="font-semibold text-purple-400">64</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Restante totale</span>
                <span className="font-semibold text-rose-400">12,340 MDL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Cereri deschise</span>
                <span className="font-semibold text-amber-400">7</span>
              </div>
            </div>
          </div>

          {/* Resident Card */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 p-6 hover:border-emerald-500/40 transition">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Locatar</h3>
                <p className="text-sm text-gray-400">Apt. 42, Bloc A</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Sold curent</span>
                <span className="font-semibold text-emerald-400">0 MDL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Ultima factura</span>
                <span className="font-semibold">850 MDL</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-white/5">
                <span className="text-gray-400">Citire contor</span>
                <span className="font-semibold text-cyan-400">Transmisa</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Preturi Simple</h2>
          <p className="text-gray-400 text-lg">Fara costuri ascunse, platesti doar ce folosesti</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Starter */}
          <div className="rounded-3xl bg-white/5 border border-white/10 p-8 hover:border-white/20 transition">
            <h3 className="text-xl font-semibold mb-2">Starter</h3>
            <p className="text-gray-400 text-sm mb-6">Pentru asociatii mici</p>
            <div className="mb-6">
              <span className="text-4xl font-bold">99</span>
              <span className="text-gray-400"> MDL/luna</span>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Pana la 30 apartamente
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Facturare automata
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Suport email
              </li>
            </ul>
            <button className="w-full py-3 rounded-xl border border-white/20 hover:bg-white/10 transition font-medium">
              Incepe Gratuit
            </button>
          </div>

          {/* Professional */}
          <div className="rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/50 p-8 relative scale-105 shadow-xl shadow-cyan-500/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-sm font-medium">
              Recomandat
            </div>
            <h3 className="text-xl font-semibold mb-2">Professional</h3>
            <p className="text-gray-400 text-sm mb-6">Pentru asociatii medii</p>
            <div className="mb-6">
              <span className="text-4xl font-bold">249</span>
              <span className="text-gray-400"> MDL/luna</span>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Pana la 100 apartamente
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Plati online integrate
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Rapoarte avansate
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Suport prioritar
              </li>
            </ul>
            <button className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 transition font-medium shadow-lg shadow-cyan-500/30">
              Incepe Acum
            </button>
          </div>

          {/* Enterprise */}
          <div className="rounded-3xl bg-white/5 border border-white/10 p-8 hover:border-white/20 transition">
            <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
            <p className="text-gray-400 text-sm mb-6">Pentru administratori</p>
            <div className="mb-6">
              <span className="text-4xl font-bold">Custom</span>
            </div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Apartamente nelimitate
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                API access
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                White-label
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Manager dedicat
              </li>
            </ul>
            <button className="w-full py-3 rounded-xl border border-white/20 hover:bg-white/10 transition font-medium">
              Contacteaza-ne
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-lg">
                E
              </div>
              <span className="text-xl font-semibold">Espace</span>
            </div>
            <p className="text-gray-400 text-sm">
              2024 Espace. Toate drepturile rezervate.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
