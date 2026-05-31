import ConnectWorkspace from '@/components/connect/ConnectWorkspace';

export default function AdminConnectConversationPage({ params }: { params: { conversationId: string } }) {
  return <ConnectWorkspace mode="admin" conversationId={params.conversationId} />;
}
