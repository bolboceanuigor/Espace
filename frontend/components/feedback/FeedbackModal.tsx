'use client';

import { useState } from 'react';
import { feedbackApi } from '@/lib/api';

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
  pageUrl: string;
};

export default function FeedbackModal({ open, onClose, pageUrl }: FeedbackModalProps) {
  const [type, setType] = useState<'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT'>('BUG');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Trimite feedback</h2>
          <button className="rounded-md border border-border/60 px-2 py-1 text-xs" onClick={onClose}>
            Inchide
          </button>
        </div>
        <div className="space-y-3">
          <select className="select w-full" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="BUG">BUG</option>
            <option value="IDEA">IDEA</option>
            <option value="QUESTION">QUESTION</option>
            <option value="COMPLAINT">COMPLAINT</option>
          </select>
          <input className="input w-full" placeholder="Titlu" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="min-h-[130px] w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm"
            placeholder="Mesaj"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <input className="input w-full" value={pageUrl} disabled />
          <input
            className="input w-full"
            placeholder="Screenshot URL (optional placeholder)"
            value={screenshotUrl}
            onChange={(e) => setScreenshotUrl(e.target.value)}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex justify-end">
            <button
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={saving}
              onClick={async () => {
                if (!title.trim() || !message.trim()) {
                  setError('Completeaza titlul si mesajul.');
                  return;
                }
                setSaving(true);
                setError(null);
                try {
                  await feedbackApi.create({
                    type,
                    title: title.trim(),
                    message: message.trim(),
                    pageUrl,
                    screenshotUrl: screenshotUrl.trim() || undefined,
                  });
                  setTitle('');
                  setMessage('');
                  setScreenshotUrl('');
                  onClose();
                } catch (e: any) {
                  setError(e?.message || 'Nu am putut trimite feedback-ul.');
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Se trimite...' : 'Trimite feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

