'use client';

import { useState } from 'react';

type Props = {
  label?: string;
  accept?: string;
  onUpload: (file: File) => Promise<void>;
};

export default function FileUploadField({ label = 'Upload file', accept, onUpload }: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <input
        type="file"
        accept={accept}
        className="block w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
        disabled={loading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLoading(true);
          try {
            await onUpload(file);
          } finally {
            setLoading(false);
            e.currentTarget.value = '';
          }
        }}
      />
    </label>
  );
}

