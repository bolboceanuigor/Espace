import { PublicWebsitePage } from '@/components/public-site/PublicWebsite';

type ProductPageProps = {
  active?: 'home' | 'features';
};

export default function EspaceProductPage({ active = 'home' }: ProductPageProps) {
  return <PublicWebsitePage page={active === 'features' ? 'features' : 'home'} />;
}
