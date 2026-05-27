import { AccessRequestForm } from '@/components/public-site/PublicWebsite';

type AccessRequestFormProps = {
  compact?: boolean;
};

export default function DemoRequestForm({ compact = false }: AccessRequestFormProps) {
  return <AccessRequestForm compact={compact} source="ACCESS_REQUEST" />;
}
