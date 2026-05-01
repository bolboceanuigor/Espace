import { notFound } from 'next/navigation';

export default function BillingSettingsPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_BILLING_UI !== 'true') {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-[0_18px_48px_-30px_rgba(109,40,217,0.35)]">
        <h1 className="text-lg font-semibold text-foreground">Billing (Internal Placeholder)</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Billing UI is feature-flagged and intentionally hidden by default.
        </p>
      </div>
    </div>
  );
}

