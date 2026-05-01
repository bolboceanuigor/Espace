'use client';

import { useEffect, useState } from 'react';
import { organizationSettingsApi } from '@/lib/api';

export default function ResidentOrganizationPage() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    organizationSettingsApi
      .residentPublicInfo()
      .then((res) => setInfo(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Organizatia mea</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4">
        {info?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.logoUrl} alt="Organization logo" className="mb-3 h-14 w-14 rounded-lg border border-border/70 object-cover" />
        ) : null}
        <p className="text-base font-semibold text-foreground">{info?.name || '-'}</p>
        <p className="text-sm text-muted-foreground">{info?.address || '-'}</p>
        <div className="mt-3 space-y-1 text-sm text-foreground">
          <p>Telefon: {info?.phone || '-'}</p>
          <p>Email: {info?.email || '-'}</p>
          <p>Website: {info?.website || '-'}</p>
          <p>Banca: {info?.bankName || '-'}</p>
          <p>IBAN: {info?.bankAccountIban || '-'}</p>
          <p>SWIFT: {info?.bankSwift || '-'}</p>
          <p>Administrator: {info?.administratorName || '-'}</p>
        </div>
        {info?.paymentInstructions ? (
          <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">{info.paymentInstructions}</div>
        ) : null}
      </div>
    </div>
  );
}
