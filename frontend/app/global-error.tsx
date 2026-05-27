'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
          <section style={{ maxWidth: 460, border: '1px solid #e2e8f0', borderRadius: 24, background: '#fff', padding: 24, textAlign: 'center' }}>
            <h1>A apărut o eroare.</h1>
            <p>Reîncarcă pagina sau revino mai târziu.</p>
            <button onClick={reset} style={{ minHeight: 44, borderRadius: 14, border: 0, background: '#0f172a', color: '#fff', padding: '0 16px', fontWeight: 700 }}>
              Reîncearcă
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
