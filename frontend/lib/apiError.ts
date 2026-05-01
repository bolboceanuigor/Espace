import { ApiClientError } from './api';

type Translator = (key: string) => string;

export function getApiErrorMessage(error: unknown, tErrors: Translator, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'VALIDATION_ERROR') return tErrors('validation');
    if (error.code === 'UNAUTHORIZED') return tErrors('unauthorized');
    if (error.code === 'FORBIDDEN') return tErrors('forbidden');
    if (error.code === 'ORG_PENDING_APPROVAL') return tErrors('ORG_PENDING_APPROVAL');
    if (error.code === 'CONFLICT_OVERLAP') return tErrors('overlap');
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }
  return fallback;
}

