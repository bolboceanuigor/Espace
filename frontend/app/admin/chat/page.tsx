'use client';

import { useCallback } from 'react';
import MesajePage, { InboxConversation, InboxMessage } from '@/components/messages/MesajePage';
import { supportChatApi } from '@/lib/api';

function mapConversation(row: any): InboxConversation {
  return {
    id: row.id,
    name: row.residentUser?.firstName || row.residentUser?.email || row.title || 'Conversație',
    preview: row.lastMessage?.content || row.preview || row.status || 'Nu există mesaje încă.',
    createdAt: row.lastMessage?.createdAt || row.updatedAt || row.createdAt,
    unread: Number(row.unreadCount || 0) > 0,
    meta: row.apartment?.number ? `Ap. ${row.apartment.number}` : row.targetType || 'Suport',
  };
}

function mapMessage(row: any): InboxMessage {
  const role = String(row.sender?.role || '').toUpperCase();
  return {
    id: row.id,
    content: row.content || row.text || '',
    createdAt: row.createdAt || new Date().toISOString(),
    mine: role !== 'RESIDENT' && role !== 'TENANT',
    senderName: row.sender?.displayName || row.sender?.firstName || row.sender?.email || 'Utilizator',
  };
}

export default function AdminChatPage() {
  const loadConversations = useCallback(async () => {
    const [support, community] = await Promise.allSettled([
      supportChatApi.adminListConversations({}),
      supportChatApi.adminListCommunity(),
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
      const response = await supportChatApi.adminGetMessages(conversationId);
      await supportChatApi.adminMarkRead(conversationId).catch(() => undefined);
      return (response.data || []).map(mapMessage);
    } catch {
      const response = await supportChatApi.adminGetCommunityMessages(conversationId);
      return (response.data || []).map(mapMessage);
    }
  }, []);

  const sendMessage = useCallback(async (conversationId: string, content: string) => {
    try {
      const response = await supportChatApi.adminSendMessage(conversationId, { content, messageType: 'TEXT' });
      return mapMessage(response.data);
    } catch {
      const response = await supportChatApi.adminSendCommunityMessage(conversationId, { content, messageType: 'TEXT' });
      return mapMessage(response.data);
    }
  }, []);

  return (
    <MesajePage
      description="Conversații interne, mesaje de suport și canale comunitare într-un inbox simplu."
      loadConversations={loadConversations}
      loadMessages={loadMessages}
      sendMessage={sendMessage}
    />
  );
}
