'use client';

import { FormEvent, useMemo, useState } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader } from '@/components/ui';

const conversations = [
  { id: 'c1', name: 'Administrație', meta: 'Apt. 45', preview: 'Am creat cererea pentru verificarea apei calde.', time: '18:24', unread: true },
  { id: 'c2', name: 'Comunitate Scara 2', meta: 'Grup', preview: 'Program curățenie pentru vineri.', time: '09:45', unread: false },
];

const initialMessages: Record<string, Array<{ id: string; sender: string; content: string; mine?: boolean; time: string }>> = {
  c1: [
    { id: 'm1', sender: 'Tu', content: 'Bună ziua, avem presiune mică la apa caldă.', mine: true, time: '18:20' },
    { id: 'm2', sender: 'Administrație', content: 'Mulțumim. Am creat o cerere și revenim cu programarea verificării.', time: '18:24' },
  ],
  c2: [{ id: 'm3', sender: 'Comunitate', content: 'Curățenia suplimentară este propusă pentru vineri dimineața.', time: '09:45' }],
};

export default function ResidentChatPage() {
  const [selectedId, setSelectedId] = useState('c1');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(initialMessages);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((item) => !needle || `${item.name} ${item.preview} ${item.meta}`.toLowerCase().includes(needle));
  }, [query]);
  const selected = conversations.find((item) => item.id === selectedId);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setMessages((current) => ({
      ...current,
      [selectedId]: [...(current[selectedId] || []), { id: `local-${Date.now()}`, sender: 'Tu', content, mine: true, time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) }],
    }));
    setDraft('');
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader title="Mesaje" description="Discuții simple cu administrația și comunitatea." />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Caută conversații" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="mt-3 space-y-2">
            {filtered.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={`w-full rounded-2xl border p-3 text-left ${selectedId === conversation.id ? 'border-foreground/20 bg-muted/70' : 'border-border/60 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{conversation.name}</p>
                  <span className="text-[11px] text-muted-foreground">{conversation.time}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{conversation.meta}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{conversation.preview}</p>
                {conversation.unread ? <Badge className="mt-2">nou</Badge> : null}
              </button>
            ))}
          </div>
        </Card>
        <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
          <div className="border-b border-border/70 p-4">
            <h2 className="inline-flex items-center gap-2 font-semibold text-foreground"><MessageCircle className="h-4 w-4" />{selected?.name}</h2>
            <p className="text-sm text-muted-foreground">{selected?.meta}</p>
          </div>
          <div className="min-h-[360px] space-y-3 p-4">
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
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Scrie un mesaj..." />
            <Button type="submit" disabled={!draft.trim()}><Send className="h-4 w-4" /> Trimite</Button>
          </form>
        </section>
      </div>
    </div>
  );
}
