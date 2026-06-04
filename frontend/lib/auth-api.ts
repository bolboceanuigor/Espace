'use client';

import { clearAuth, getToken } from './auth';
import { getApiBaseUrl } from './runtime-config';

const API_URL = getApiBaseUrl();
const AUTH_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_AUTH_REQUEST_TIMEOUT_MS || 12000);

type AuthApiMethod = 'GET' | 'POST' | 'PATCH';

type AuthApiErrorPayload = {
  code?: string;
  message: string | string[];
  details?: unknown;
};

type AuthApiOptions = {
  method?: AuthApiMethod;
  body?: unknown;
};

export class AuthApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  response: { status: number; data: { error: AuthApiErrorPayload } };

  constructor(status: number, error: AuthApiErrorPayload) {
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = error.code || 'REQUEST_ERROR';
    this.details = error.details;
    this.response = { status, data: { error } };
  }
}

function normalizeAuthApiPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.startsWith('/api/') ? normalized : `/api${normalized}`;
}

async function parseErrorPayload(response: Response): Promise<AuthApiErrorPayload> {
  if (response.status === 401) {
    return {
      code: 'UNAUTHORIZED',
      message: 'Sesiunea a expirat. Te rugăm să te autentifici din nou.',
    };
  }

  if (response.status === 403) {
    return {
      code: 'FORBIDDEN',
      message: 'Nu ai acces la această zonă.',
    };
  }

  try {
    const body = await response.json();
    if (body?.error?.code) return body.error as AuthApiErrorPayload;
    if (body?.code) return body as AuthApiErrorPayload;
    return {
      code: 'REQUEST_ERROR',
      message: body?.message || 'Nu am putut procesa cererea.',
    };
  } catch {
    return {
      code: 'REQUEST_ERROR',
      message: 'Nu am putut procesa cererea.',
    };
  }
}

async function authRequest<T>(path: string, options: AuthApiOptions = {}): Promise<{ data: T }> {
  const { method = 'GET', body } = options;

  if (!API_URL) {
    throw new AuthApiError(503, {
      code: 'API_URL_MISSING',
      message: 'API-ul nu este disponibil temporar.',
    });
  }

  const requestUrl = `${API_URL}${normalizeAuthApiPath(path)}`;
  const token = getToken();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS)
    : null;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal: controller?.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AuthApiError(504, {
        code: 'REQUEST_TIMEOUT',
        message: 'API-ul răspunde prea greu. Te rugăm să reîncerci autentificarea.',
      });
    }

    throw new AuthApiError(503, {
      code: 'NETWORK_ERROR',
      message: 'API-ul nu este disponibil temporar.',
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    if (response.status === 401 && typeof window !== 'undefined') {
      clearAuth();
    }
    throw new AuthApiError(response.status, payload);
  }

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const payload = await response.json();
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return { data: payload.data as T };
  }

  return { data: payload as T };
}

export const authApi = {
  register: (data: { orgName: string; email: string; password: string; locale?: string; firstName?: string; lastName?: string }) =>
    authRequest<any>('/auth/register', { method: 'POST', body: data }),
  login: (data: { email: string; password: string }) =>
    authRequest<any>('/auth/login', { method: 'POST', body: data }),
  demoLogin: () => authRequest<any>('/auth/demo-login', { method: 'POST' }),
  logout: () => authRequest<any>('/auth/logout', { method: 'POST' }),
  verifyEmail: (token: string) => authRequest<any>('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (data: { email: string; locale?: string }) =>
    authRequest<any>('/auth/resend-verification', { method: 'POST', body: data }),
  forgotPassword: (data: { email: string; locale?: string }) =>
    authRequest<any>('/auth/forgot-password', { method: 'POST', body: data }),
  resetPassword: (data: { token: string; newPassword: string }) =>
    authRequest<any>('/auth/reset-password', { method: 'POST', body: data }),
  validateResetToken: (token: string) =>
    authRequest<{ valid: boolean }>('/auth/validate-reset-token', { method: 'POST', body: { token } }),
  resetPasswordWithToken: (token: string, data: { password: string; confirmPassword: string }) =>
    authRequest<any>('/auth/reset-password', { method: 'POST', body: { token, newPassword: data.password } }),
  accountStatus: () => authRequest<any>('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    authRequest<any>('/auth/change-password', { method: 'POST', body: data }),
  getMe: () => authRequest<any>('/auth/me'),
  updatePreferences: (data: {
    locale?: 'ro' | 'ru' | 'en';
    sidebarLabels?: boolean;
    calendarZoom?: 'sm' | 'md' | 'lg';
    calendarStatusFilter?: string;
    calendarGroupId?: string | null;
    welcomeDismissed?: boolean;
  }) =>
    authRequest<any>('/me/preferences', { method: 'PATCH', body: data }),
};
