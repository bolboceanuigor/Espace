'use client';

import { useEffect, useState } from 'react';
import { privacyApi } from '@/lib/api';

type PrivacySettings = {
  showResidentNamesInCommunity: boolean;
  showApartmentNumbersInCommunity: boolean;
  allowResidentsToContactEachOther: boolean;
  showIssueReporterName: boolean;
  showVoteParticipants: boolean;
};

const DEFAULTS: PrivacySettings = {
  showResidentNamesInCommunity: false,
  showApartmentNumbersInCommunity: false,
  allowResidentsToContactEachOther: false,
  showIssueReporterName: false,
  showVoteParticipants: false,
};

export default function AdminPrivacySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PrivacySettings>(DEFAULTS);

  useEffect(() => {
    privacyApi
      .adminGet()
      .then((res) => setForm({ ...DEFAULTS, ...(res.data || {}) }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading privacy settings...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Privacy settings</h1>
      <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
        {[
          ['showResidentNamesInCommunity', 'Show resident names in community'],
          ['showApartmentNumbersInCommunity', 'Show apartment numbers in community'],
          ['allowResidentsToContactEachOther', 'Allow residents to contact each other'],
          ['showIssueReporterName', 'Show issue reporter name'],
          ['showVoteParticipants', 'Show vote participants'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-2 text-sm text-foreground">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={Boolean((form as any)[key])}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
            />
          </label>
        ))}
      </div>
      <button
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await privacyApi.adminUpdate(form);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? 'Saving...' : 'Save privacy settings'}
      </button>
    </div>
  );
}

