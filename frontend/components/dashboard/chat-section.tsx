'use client';

const chatRooms = [
  { name: 'General', members: '124 membri', active: true },
  { name: 'Administratori', members: '8 membri', active: false },
  { name: 'Locatari - Scara A', members: '36 membri', active: false },
];

const messages = [
  { author: 'Maria D.', text: 'Buna seara! Liftul din scara B a fost reparat.', time: '12 min', mine: false },
  { author: 'Admin Igor', text: 'Perfect, multumesc pentru update.', time: '8 min', mine: true },
  { author: 'Andrei P.', text: 'Cand publicam lista de cheltuieli pe luna curenta?', time: '2 min', mine: false },
];

export function ChatSection() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_2.1fr]">
      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Chat Locatari</h3>
          <span className="text-xs text-muted-foreground">12 online</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {chatRooms.map((room) => (
            <div
              key={room.name}
              className={`rounded-xl border px-3 py-2 ${room.active ? 'border-blue-200 bg-blue-50/80' : 'border-border/60 bg-background'}`}
            >
              <p className="text-sm font-medium text-foreground">{room.name}</p>
              <p className="text-xs text-muted-foreground">{room.members}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-base font-semibold text-foreground">Mesaje</h3>
          <span className="text-xs text-muted-foreground">General</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {messages.map((message, index) => (
            <div key={`${message.author}-${index}`} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[78%] rounded-xl px-3 py-2 ${
                  message.mine ? 'bg-blue-600 text-white' : 'border border-border/60 bg-background text-foreground'
                }`}
              >
                <p className={`text-[11px] ${message.mine ? 'text-white/80' : 'text-muted-foreground'}`}>{message.author}</p>
                <p className="mt-0.5 text-sm">{message.text}</p>
                <p className={`mt-1 text-[10px] ${message.mine ? 'text-white/80' : 'text-muted-foreground'}`}>{message.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <input
              className="h-10 flex-1 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50"
              placeholder="Scrie un mesaj..."
            />
            <button className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white">Trimite</button>
          </div>
        </div>
      </section>
    </div>
  );
}

