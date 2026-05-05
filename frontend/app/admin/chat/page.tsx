'use client';

import { FormEvent, useMemo, useState } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui';
import { adminConversations, type AdminConversation } from '@/lib/admin-mvp-data';

type MessageMap = Record<string, AdminConversation['messages']>;

export default function AdminChatPage() {
  const [conversations, setConversations] = useState(adminConversations);
  const [messages, setMessages] = useState<MessageMap>(() =>
    Object.fromEntries(adminConversations.map((conversation) => [conversation.id, conversation.messages])),
  );
  const [selectedId, setSelectedId] = useState(adminConversations[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((item) => !needle || `${item.resident} ${item.apartment} ${item.preview}`.toLowerCase().includes(needle));
  }, [conversations, query]);

  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0];

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setConversations((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selected) return;
    setMessages((current) => ({
      ...current,
      [selected.id]: [
        ...(current[selected.id] || []),
        {
          id: `local-${Date.now()}`,
          sender: 'Admin',
          content,
          mine: true,
          time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    }));
    setDraft('');
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Mesaje" description="Conversații cu locatarii și discuții comunitare." />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută conversații" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {filtered.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`min-w-[260px] rounded-2xl border p-3 text-left transition lg:w-full lg:min-w-0 ${
                  selected?.id === conversation.id ? 'border-foreground/20 bg-muted/70' : 'border-border/60 bg-white hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{conversation.resident}</p>
                  <span className="text-[11px] text-muted-foreground">{conversation.time}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{conversation.apartment}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{conversation.preview}</p>
                {conversation.unread ? <Badge className="mt-2" variant="default">necitit</Badge> : null}
              </button>
            ))}
          </div>
        </Card>

        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="border-b border-border/70 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <MessageCircle className="h-4 w-4" />
              {selected?.resident}
            </h2>
            <p className="text-sm text-muted-foreground">{selected?.apartment}</p>
          </div>

          <div className="min-h-[420px] space-y-3 bg-muted/20 p-4">
            {(messages[selected?.id ?? ''] || []).map((message) => (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? 'bg-foreground text-background' : 'bg-white text-foreground'}`}>
                  <p className="mb-1 text-[11px] opacity-70">{message.sender} · {message.time}</p>
                  <p className="leading-6">{message.content}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border/70 p-3">
            <Input className="min-w-0 flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Scrie un mesaj..." />
            <Button type="submit" disabled={!draft.trim()}><Send className="h-4 w-4" /> Trimite</Button>
          </form>
        </section>
      </div>
    </div>
  );
}
