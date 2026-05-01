'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  type?: 'success' | 'error';
  duration?: number;
}

export default function Toast({
  message,
  visible,
  onDismiss,
  type = 'success',
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (!visible || !message) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [visible, message, duration, onDismiss]);

  if (!visible || !message) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] animate-modal-in">
      <div
        className={`rounded-lg shadow-xl px-5 py-3 text-sm font-medium text-white transition-all duration-200 ${
          type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}
      >
        {message}
      </div>
    </div>
  );
}
