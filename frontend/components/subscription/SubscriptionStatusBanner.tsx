'use client';

type Props = {
  status: string | null | undefined;
  trialEndDate?: string | null;
};

export default function SubscriptionStatusBanner({ status, trialEndDate }: Props) {
  const normalized = String(status || '').toUpperCase();
  if (!normalized || normalized === 'ACTIVE') return null;

  if (normalized === 'TRIAL') {
    const dateText = trialEndDate ? new Date(trialEndDate).toLocaleDateString() : '-';
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Perioada de proba este activa pana la {dateText}
      </div>
    );
  }

  if (normalized === 'PAST_DUE') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Abonamentul este restant. Puteti vizualiza datele, dar actiunile de creare sunt blocate.
      </div>
    );
  }

  if (normalized === 'SUSPENDED') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        Abonamentul este suspendat. Contactati suportul.
      </div>
    );
  }

  if (normalized === 'CANCELLED') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
        Abonamentul este anulat. Accesul administrativ este restrictionat.
      </div>
    );
  }

  return null;
}
