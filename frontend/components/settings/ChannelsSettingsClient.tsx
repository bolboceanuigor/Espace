'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, PageHeader, useToast } from '@/components/ui';
import { channelsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/apiError';

type ChannelKey = 'AIRBNB' | 'BOOKING';
type ChannelConfig = {
  id?: string;
  channel: ChannelKey;
  isEnabled: boolean;
  icsUrl: string;
  externalListingId?: string | null;
};
type PropertyWithChannels = {
  id: string;
  name: string;
  code?: string | null;
  channels: Array<{
    id: string;
    channel: ChannelKey;
    isEnabled: boolean;
    icsUrl: string | null;
    externalListingId: string | null;
  }>;
};

const CHANNELS: ChannelKey[] = ['AIRBNB', 'BOOKING'];

export default function ChannelsSettingsClient() {
  const c = useTranslations('common');
  const tErrors = useTranslations('errors');
  const { showToast } = useToast();
  const { user } = useAuth();
  const normalizedRole = (user?.role || '').toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN';

  const [items, setItems] = useState<PropertyWithChannels[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, Record<ChannelKey, ChannelConfig>>>({});

  useEffect(() => {
    let active = true;
    channelsApi
      .getSettings()
      .then((res) => {
        if (!active) return;
        const nextItems: PropertyWithChannels[] = res.data?.properties ?? [];
        setItems(nextItems);
        const nextForms: Record<string, Record<ChannelKey, ChannelConfig>> = {};
        nextItems.forEach((property) => {
          const map = {} as Record<ChannelKey, ChannelConfig>;
          CHANNELS.forEach((channel) => {
            const existing = property.channels.find((item) => item.channel === channel);
            map[channel] = {
              id: existing?.id,
              channel,
              isEnabled: !!existing?.isEnabled,
              icsUrl: existing?.icsUrl || '',
              externalListingId: existing?.externalListingId ?? null,
            };
          });
          nextForms[property.id] = map;
        });
        setForms(nextForms);
      })
      .catch((error: unknown) => showToast(getApiErrorMessage(error, tErrors, c('error')), 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [c, showToast, tErrors]);

  const rows = useMemo(() => items, [items]);

  const setChannelValue = (propertyId: string, channel: ChannelKey, patch: Partial<ChannelConfig>) => {
    setForms((prev) => ({
      ...prev,
      [propertyId]: {
        ...prev[propertyId],
        [channel]: {
          ...prev[propertyId]?.[channel],
          ...patch,
        },
      },
    }));
  };

  const saveProperty = async (propertyId: string) => {
    if (!isAdmin) return;
    const propertyConfig = forms[propertyId];
    if (!propertyConfig) return;
    setSavingId(propertyId);
    try {
      for (const channel of CHANNELS) {
        const config = propertyConfig[channel];
        await channelsApi.updatePropertyChannel(propertyId, {
          channel,
          isEnabled: config.isEnabled,
          icsUrl: config.icsUrl.trim() || undefined,
        });
      }
      showToast(c('saved'), 'success');
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, tErrors, c('error')), 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Channels" description="iCal sync placeholders for Airbnb and Booking." />
      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">Loading...</div>
      ) : null}
      {!loading ? rows.map((property) => (
        <div key={property.id} className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{property.name}</p>
              <p className="text-xs text-muted-foreground">{property.code || '-'}</p>
            </div>
            <Button size="sm" onClick={() => saveProperty(property.id)} disabled={!isAdmin || savingId === property.id}>
              {savingId === property.id ? '...' : 'Save'}
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {CHANNELS.map((channel) => {
              const state = forms[property.id]?.[channel];
              return (
                <div key={channel} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{channel}</p>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!state?.isEnabled}
                        onChange={(event) =>
                          setChannelValue(property.id, channel, { isEnabled: event.target.checked })
                        }
                        disabled={!isAdmin}
                      />
                      Enable iCal
                    </label>
                  </div>
                  <input
                    className="mt-2 h-9 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground"
                    placeholder="ICS URL"
                    value={state?.icsUrl || ''}
                    onChange={(event) => setChannelValue(property.id, channel, { icsUrl: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )) : null}
    </div>
  );
}

