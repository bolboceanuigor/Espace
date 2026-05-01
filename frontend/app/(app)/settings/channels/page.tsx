import { notFound } from 'next/navigation';
import ChannelsSettingsClient from '@/components/settings/ChannelsSettingsClient';

export default function SettingsChannelsPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_CHANNELS_UI !== 'true') {
    notFound();
  }

  return <ChannelsSettingsClient />;
}

