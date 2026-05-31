import ConnectWorkspace from '@/components/connect/ConnectWorkspace';

export default function ResidentConnectConversationPage({ params }: { params: { conversationId: string } }) {
  return <ConnectWorkspace mode="resident" conversationId={params.conversationId} />;
}
