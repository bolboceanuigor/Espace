'use client';

import { FormEvent, useMemo, useState } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui';

const initialConversations = [
  { id: 'c1', name: 'Popescu Ion', meta: 'Apt. 45', preview: 'Bună ziua, avem o problemă la balcon.', time: '30 Apr, 18:20', unread: true },
  { id: 'c2', name: 'Ionescu Maria', meta: 'Apt. 18', preview: 'Mulțumesc, plata a fost confirmată.', time: '29 Apr, 11:10', unread: false },
  { id: 'c3', name: 'Grup Scara 2', meta: 'Comunitate', preview: 'Discuție despre programul curățeniei.', time: '28 Apr, 09:45', unread: false },
];

const initialMessages: Record<string, Array<{ id: string; sender: string; content: string; mine?: boolean; time: string }>> = {
  c1: [
    { id: 'm1', sender: 'Popescu Ion', content: 'Bună ziua, avem o problemă la balcon după ultima ploaie.', time: '18:20' },
    { id: 'm2', sender: 'Admin', content: 'Mulțumesc. Am creat o cerere și revenim cu programarea verificării.', mine: true, time: '18:24' },
  ],
  c2: [{ id: 'm3', sender: 'Admin', content: 'Plata a fost confirmată în sistem.', mine: true, time: '11:10' }],
  c3: [{ id: 'm4', sender: 'Grup Scara 2', content: 'Propunem curățenie suplimentară vinerea.', time: '09:45' }],
};

export default function AdminChatPage() {
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState(initialMessages);
  const [selectedId, setSelectedId] = useState('c1');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((item) => !needle || `${item.name} ${item.meta} ${item.preview}`.toLowerCase().includes(needle));
  }, [conversations, query]);
  const selected = conversations.find((item) => item.id === selectedId);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setMessages((current) => ({
      ...current,
      [selectedId]: [...(current[selectedId] || []), { id: `local-${Date.now()}`, sender: 'Admin', content, mine: true, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) }],
    }));
    setDraft('');
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Mesaje" description="Inbox pentru conversații cu locatarii și discuții comunitare." />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută conversații" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="mt-3 space-y-2">
            {filtered.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setSelectedId(conversation.id);
                  setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unread: false } : item));
                }}
                className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === conversation.id ? 'border-foreground/20 bg-muted/70' : 'border-border/60 bg-white hover:bg-muted/50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{conversation.name}</p>
                  <span className="text-[11px] text-muted-foreground">{conversation.time}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{conversation.meta}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{conversation.preview}</p>
                {conversation.unread ? <Badge className="mt-2" variant="default">necitit</Badge> : null}
              </button>
            ))}
          </div>
        </Card>
        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="border-b border-border/70 p-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground"><MessageCircle className="h-4 w-4" />{selected?.name}</h2>
            <p className="text-sm text-muted-foreground">{selected?.meta}</p>
          </div>
          <div className="min-h-[380px] space-y-3 p-4">
            {(messages[selectedId] || []).map((message) => (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.mine ? 'bg-foreground text-background' : 'bg-muted/75 text-foreground'}`}>
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
