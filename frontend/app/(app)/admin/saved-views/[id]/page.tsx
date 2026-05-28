import { SavedViewDetailPage } from '@/components/saved-views/SavedViewsPages';

export default function AdminSavedViewDetailRoute({ params }: { params: { id: string } }) {
  return <SavedViewDetailPage id={params.id} />;
}
