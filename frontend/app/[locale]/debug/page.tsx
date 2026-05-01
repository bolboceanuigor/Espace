import { notFound } from 'next/navigation';
import { DebugClientPage } from './DebugClientPage';

export default function DebugPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <DebugClientPage />;
}
