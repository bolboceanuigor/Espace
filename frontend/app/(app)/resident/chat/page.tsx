'use client';

import { useCallback } from 'react';
import MesajePage, { InboxConversation, InboxMessage } from '@/components/messages/MesajePage';
import { getUser } from '@/lib/auth';
import { supportChatApi } from '@/lib/api';

function mapConversation(row: any): InboxConversation {
  return {
    id: row.id,
    name: row.title || row.assignedTo?.firstName || 'Administrație',
    preview: row.lastMessage?.content || row.preview || row.status || 'Nu există mesaje încă.',
    createdAt: row.lastMessage?.createdAt || row.updatedAt || row.createdAt,
    unread: Number(row.unreadCount || 0) > 0,
    meta: row.targetType || row.status || 'Suport',
  };
}

function mapMessage(row: any): InboxMessage {
  const currentUserId = getUser()?.id || getUser()?.sub || '';
  return {
    id: row.id,
    content: row.content || row.text || '',
    createdAt: row.createdAt || new Date().toISOString(),
    mine: row.senderUserId === currentUserId,
    senderName: row.sender?.displayName || row.sender?.firstName || row.sender?.email || 'Utilizator',
  };
}

export default function ResidentChatPage() {
  const loadConversations = useCallback(async () => {
    const [support, community] = await Promise.allSettled([
      supportChatApi.residentListConversations(),
      supportChatApi.residentListCommunity(),
    ]);
    const supportRows = support.status === 'fulfilled' ? support.value.data || [] : [];
    const communityRows = community.status === 'fulfilled' ? community.value.data || [] : [];
    if (support.status === 'rejected' && community.status === 'rejected') {
      throw support.reason;
    }
    return [...supportRows, ...communityRows].map(mapConversation);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await supportChatApi.residentGetMessages(conversationId);
      await supportChatApi.residentMarkRead(conversationId).catch(() => undefined);
      return (response.data || []).map(mapMessage);
    } catch {
      const response = await supportChatApi.residentGetCommunityMessages(conversationId);
      return (response.data || []).map(mapMessage);
    }
  }, []);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    try {
      const response = await supportChatApi.residentSendMessage(conversationId, { content, messageType: 'TEXT' });
      return mapMessage(response.data);
    } catch {
      const response = await supportChatApi.residentSendCommunityMessage(conversationId, { content, messageType: 'TEXT' });
      return mapMessage(response.data);
    }
  }, []);

  return (
    <MesajePage
      description="Mesaje cu administrația și comunitatea, ușor de citit și de urmărit."
      loadConversations={loadConversations}
      loadMessages={loadMessages}
      sendMessage={sendMessage}
    />
  );
}
