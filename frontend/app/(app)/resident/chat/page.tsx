'use client';

import { FormEvent, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button, Card, Input, PageHeader } from '@/components/ui';
import { residentDemoApi } from '@/lib/api';
import { normalizeResidentContext, residentMessages, residentProfile } from '@/lib/resident-mvp-data';

export default function ResidentChatPage() {
  const [messages, setMessages] = useState(residentMessages);
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState<ReturnType<typeof normalizeResidentContext> | null>(null);

  useEffect(() => {
    let active = true;
    residentDemoApi
      .context()
      .then((res) => {
        if (active) setContext(normalizeResidentContext(res.data));
      })
      .catch(() => {
        if (active) {
          setContext({
            ...residentProfile,
            hasApartment: true,
            emptyStateMessage: '',
          } as ReturnType<typeof normalizeResidentContext>);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        sender: 'Tu',
        content,
        mine: true,
        time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setDraft('');
  };

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        title="Mesaje"
        description="Discuție simplă cu administrația."
        rightSlot={
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
            Demo
          </span>
        }
      />
      <section className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.045)]">
        <div className="border-b border-border/70 p-4">
          <h2 className="inline-flex items-center gap-2 font-semibold text-foreground">
            <MessageCircle className="h-4 w-4" />
            Administrație
          </h2>
          <p className="text-sm text-muted-foreground">
            {context ? [context.apartment, context.staircase].filter(Boolean).join(' · ') : 'Se încarcă apartamentul...'}
          </p>
        </div>
        <div className="min-h-[460px] space-y-3 bg-muted/20 p-4">
          {messages.map((message) => (
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
  );
}
