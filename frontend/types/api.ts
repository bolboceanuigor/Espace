export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string | string[];
    details?: unknown;
  } | null;
};

export type ApiErrorPayload = {
  code: string;
  message: string | string[];
  details?: unknown;
};

