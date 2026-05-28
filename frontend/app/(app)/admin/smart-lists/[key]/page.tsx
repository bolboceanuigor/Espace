import { SmartListDetailPage } from '@/components/saved-views/SavedViewsPages';

export default function AdminSmartListDetailRoute({ params }: { params: { key: string } }) {
  return <SmartListDetailPage smartKey={params.key} />;
}
