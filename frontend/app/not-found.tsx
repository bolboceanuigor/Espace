import Link from 'next/link';

export default function RootNotFound() {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-border/60 bg-card p-5 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pagina nu exista</p>
      <Link
        href="/login"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-xl border border-border/60 px-3 text-sm text-foreground transition duration-150 ease-out hover:bg-muted/60"
      >
        Autentificare
      </Link>
    </div>
  );
}
