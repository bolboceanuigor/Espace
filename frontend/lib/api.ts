import { clearAuth, getToken, getUser } from './auth';
import type { ApiEnvelope, ApiErrorPayload } from '@/types/api';
import { getApiBaseUrl } from './runtime-config';

const API_URL = getApiBaseUrl();
const ACTIVE_ORG_STORAGE_KEY = 'activeOrgId';

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;
  response: { status: number; data: { error: ApiErrorPayload } };

  constructor(status: number, error: ApiErrorPayload) {
    const message = Array.isArray(error.message) ? error.message.join(', ') : error.message;
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = error.code || 'REQUEST_ERROR';
    this.details = error.details;
    this.response = { status, data: { error } };
  }
}

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ApiOptions = {
  method?: ApiMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  responseType?: 'json' | 'blob' | 'text';
  cache?: RequestCache;
};

function toQueryString(params?: ApiOptions['params']): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function normalizeApiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/health' || normalized.startsWith('/health/')) return normalized;
  return normalized.startsWith('/api/') ? normalized : `/api${normalized}`;
}

function getOrgScopeHeader(path: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  if (normalizeApiPath(path).startsWith('/api/superadmin/')) return {};
  const user = getUser();
  const role = (user?.role || '').toString().toUpperCase();
  if (role !== 'SUPERADMIN') return {};
  const activeOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  if (!activeOrgId) return {};
  return { 'x-org-id': activeOrgId };
}

function redirectToExpiredLogin() {
  if (typeof window === 'undefined') return;
  const pathname = window.location.pathname;
  if (pathname.includes('/login') || pathname.includes('/register') || pathname.includes('/signup')) return;
  const parts = pathname.split('/').filter(Boolean);
  const locale = ['ro', 'ru', 'en'].includes(parts[0] || '') ? parts[0] : '';
  const loginPath = locale ? `/${locale}/login?expired=1` : '/login?expired=1';
  window.location.href = loginPath;
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload> {
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
    if (body?.error?.code) return normalizeErrorMessage(response.status, body.error as ApiErrorPayload);
    if (body?.code) return normalizeErrorMessage(response.status, body as ApiErrorPayload);
    return normalizeErrorMessage(response.status, {
      code: 'REQUEST_ERROR',
      message: body?.message || 'Nu am putut procesa cererea.',
    });
  } catch {
    return normalizeErrorMessage(response.status, {
      code: 'REQUEST_ERROR',
      message: 'Nu am putut procesa cererea.',
    });
  }
}

function normalizeErrorMessage(status: number, payload: ApiErrorPayload): ApiErrorPayload {
  if (status >= 500) {
    return {
      ...payload,
      code: payload.code || 'INTERNAL_ERROR',
      message: 'A apărut o eroare. Încearcă din nou.',
      details: undefined,
    };
  }
  if (status === 400 && payload.message === 'Validation failed') {
    return { ...payload, message: 'Datele trimise nu sunt valide.' };
  }
  return payload;
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<{ data: T }> {
  const {
    method = 'GET',
    body,
    params,
    headers,
    responseType = 'json',
    cache = 'no-store',
  } = options;

  if (!API_URL) {
    throw new ApiClientError(503, {
      code: 'API_URL_MISSING',
      message: 'API-ul online nu este conectat încă. Interfața poate fi vizualizată, dar autentificarea și datele reale sunt indisponibile momentan.',
      details: { env: 'NEXT_PUBLIC_API_URL' },
    });
  }

  const requestUrl = `${API_URL}${normalizeApiPath(path)}${toQueryString(params)}`;
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    console.debug(`[API] ${method} ${requestUrl}`);
  }

  let response: Response;
  try {
    const token = getToken();
    response = await fetch(requestUrl, {
      method,
      credentials: 'include',
      cache,
      headers: {
        ...(responseType === 'json' ? { 'Content-Type': 'application/json' } : {}),
        Accept: responseType === 'json' ? 'application/json' : '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getOrgScopeHeader(path),
        ...(headers || {}),
      },
      body: body !== undefined && responseType === 'json' ? JSON.stringify(body) : (body as BodyInit | undefined),
    });
  } catch {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      console.error(`[API] ${method} ${requestUrl} status=NETWORK_ERROR`);
    }
    throw new ApiClientError(503, {
      code: 'NETWORK_ERROR',
      message: 'API-ul online nu răspunde momentan. Încearcă din nou după ce backend-ul este publicat.',
      details: { env: 'NEXT_PUBLIC_API_URL' },
    });
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      console.error('[api:error]', {
        url: requestUrl,
        method,
        status: response.status,
        code: payload.code,
        message: payload.message,
      });
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      redirectToExpiredLogin();
    }
    throw new ApiClientError(response.status, payload);
  }

  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    console.debug(`[API] ${method} ${requestUrl} status=${response.status}`);
  }

  if (responseType === 'blob') {
    return { data: (await response.blob()) as T };
  }
  if (responseType === 'text') {
    return { data: (await response.text()) as T };
  }
  if (response.status === 204) {
    return { data: undefined as T };
  }

  const payload = (await response.json()) as ApiEnvelope<T> | T;
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return { data: (payload as ApiEnvelope<T>).data };
  }
  return { data: payload as T };
}

export { apiRequest as api };

function requireApiUrl() {
  if (API_URL) return API_URL;
  throw new ApiClientError(503, {
    code: 'API_URL_MISSING',
    message: 'API-ul online nu este conectat încă. Această acțiune necesită backend-ul.',
    details: { env: 'NEXT_PUBLIC_API_URL' },
  });
}

export const authApi = {
  register: (data: { orgName: string; email: string; password: string; locale?: string; firstName?: string; lastName?: string }) =>
    apiRequest<any>('/api/auth/register', { method: 'POST', body: data }),
  login: (data: { email: string; password: string }) =>
    apiRequest<any>('/auth/login', { method: 'POST', body: data }),
  demoLogin: () => apiRequest<any>('/auth/demo-login', { method: 'POST' }),
  logout: () => apiRequest<any>('/auth/logout', { method: 'POST' }),
  verifyEmail: (token: string) => apiRequest<any>('/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (data: { email: string; locale?: string }) =>
    apiRequest<any>('/auth/resend-verification', { method: 'POST', body: data }),
  forgotPassword: (data: { email: string; locale?: string }) =>
    apiRequest<any>('/auth/forgot-password', { method: 'POST', body: data }),
  resetPassword: (data: { token: string; newPassword: string }) =>
    apiRequest<any>('/auth/reset-password', { method: 'POST', body: data }),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    apiRequest<any>('/auth/change-password', { method: 'POST', body: data }),
  getMe: () => apiRequest<any>('/auth/me'),
  getNavigation: () => apiRequest<any[]>('/api/me/navigation'),
  updatePreferences: (data: {
    locale?: 'ro' | 'ru' | 'en';
    sidebarLabels?: boolean;
    calendarZoom?: 'sm' | 'md' | 'lg';
    calendarStatusFilter?: string;
    calendarGroupId?: string | null;
    welcomeDismissed?: boolean;
  }) =>
    apiRequest<any>('/api/me/preferences', { method: 'PATCH', body: data }),
};

export const propertiesApi = {
  getAll: (showArchived?: boolean) =>
    apiRequest<any[]>('/properties', {
      params: showArchived !== undefined ? { showArchived } : undefined,
    }),
  getOne: (id: string) => apiRequest<any>(`/properties/${id}`),
  getStats: (id: string) => apiRequest<any>(`/properties/${id}/stats`),
  create: (data: {
    name: string;
    address: string;
    basePrice: number;
    cleaningFee: number;
    rooms: number;
    status?: string;
    groupId?: string;
    color?: string;
  }) =>
    apiRequest<any>('/properties', { method: 'POST', body: data }),
  update: (id: string, data: Partial<any>) => apiRequest<any>(`/properties/${id}`, { method: 'PATCH', body: data }),
  delete: (id: string) => apiRequest<any>(`/properties/${id}`, { method: 'DELETE' }),
  getGroups: () => apiRequest<any[]>('/properties/meta/groups'),
  createGroup: (name: string) => apiRequest<any>('/properties/meta/groups', { method: 'POST', body: { name } }),
};

export const subscriptionApi = {
  get: () => apiRequest<any>('/subscription'),
  changePlan: (plan: string) => apiRequest<any>('/subscription/change-plan', { method: 'POST', body: { plan } }),
};

export const usageApi = {
  today: () => apiRequest<any>('/usage/today'),
};

export const organizationsApi = {
  getMe: () => apiRequest<any>('/organizations/me'),
  updateMe: (data: { name?: string; onboardingCompleted?: boolean; defaultLocale?: 'ro' | 'ru' | 'en'; weekStart?: 'MONDAY' | 'SUNDAY' }) =>
    apiRequest<any>('/organizations/me', { method: 'PATCH', body: data }),
  getActivity: () => apiRequest<any>('/organizations/activity'),
  getOnboardingState: () => apiRequest<any>('/organizations/onboarding'),
  dismissOnboarding: () => apiRequest<any>('/organizations/onboarding/dismiss', { method: 'POST' }),
  loadDemoData: () => apiRequest<any>('/organizations/onboarding/load-demo', { method: 'POST' }),
  invite: (data: { email: string; role: string; firstName?: string; lastName?: string }) =>
    apiRequest<any>('/organizations/invite', { method: 'POST', body: data }),
};

export const settingsApi = {
  get: () =>
    apiRequest<{
      org: {
        id: string;
        name: string;
        defaultLocale: 'ro' | 'ru' | 'en';
        weekStart: 'MONDAY' | 'SUNDAY';
        appName: string;
        logoUrl: string | null;
        primaryColor: string;
        sidebarColor: string;
        themeMode: 'LIGHT' | 'DARK';
        menuConfig: Array<{ key: string; enabled: boolean; order: number }>;
      };
      profile: { id: string; email: string; firstName: string | null; lastName: string | null; role: string };
      supportEmail: string;
    }>('/api/settings'),
  updateOrg: (data: {
    name?: string;
    defaultLocale?: 'ro' | 'ru' | 'en';
    weekStart?: 'MONDAY' | 'SUNDAY';
    appName?: string;
    logoUrl?: string;
    primaryColor?: string;
    sidebarColor?: string;
    themeMode?: 'LIGHT' | 'DARK';
    menuConfig?: Array<{ key: string; enabled: boolean; order: number }>;
  }) =>
    apiRequest<any>('/api/settings/org', { method: 'PATCH', body: data }),
  updateProfile: (data: { firstName?: string; lastName?: string }) =>
    apiRequest<any>('/api/settings/profile', { method: 'PATCH', body: data }),
};

export const usersApi = {
  getAll: () => apiRequest<any[]>('/users'),
  getOne: (id: string) => apiRequest<any>(`/users/${id}`),
  update: (id: string, data: { role?: string; isActive?: boolean; firstName?: string; lastName?: string }) =>
    apiRequest<any>(`/users/${id}`, { method: 'PATCH', body: data }),
  delete: (id: string) => apiRequest<any>(`/users/${id}`, { method: 'DELETE' }),
};

export const clientsApi = {
  getAll: (page?: number, pageSize?: number, showArchived?: boolean) =>
    apiRequest<any>('/clients', {
      params: {
        ...(page ? { page } : {}),
        ...(pageSize ? { pageSize } : {}),
        ...(showArchived !== undefined ? { showArchived } : {}),
      },
    }),
  getOne: (id: string) => apiRequest<any>(`/clients/${id}`),
  getReservations: (id: string) => apiRequest<any[]>(`/clients/${id}/reservations`),
  create: (data: { firstName: string; lastName?: string; phone: string; email?: string; notes?: string }) =>
    apiRequest<any>('/clients', { method: 'POST', body: data }),
  update: (id: string, data: Partial<{ firstName: string; lastName: string; phone: string; email: string; notes: string }>) =>
    apiRequest<any>(`/clients/${id}`, { method: 'PATCH', body: data }),
  delete: (id: string) => apiRequest<any>(`/clients/${id}`, { method: 'DELETE' }),
};

export const reservationsApi = {
  getAll: (params?: {
    start?: string;
    end?: string;
    status?: string;
    source?: string;
    propertyId?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) =>
    apiRequest<any>('/reservations', {
      params,
    }),
  getByWeek: (startDate: string) => apiRequest<any[]>('/reservations/by-week', { params: { startDate } }),
  getOne: (id: string) => apiRequest<any>(`/reservations/${id}`),
  create: (data: {
    propertyId: string;
    guestName: string;
    phoneNumber?: string;
    checkIn: string;
    checkOut: string;
    totalPrice?: number;
    status?: string;
    source?: string;
    notes?: string;
  }) => apiRequest<any>('/reservations', { method: 'POST', body: data }),
  update: (id: string, data: Partial<any>) => apiRequest<any>(`/reservations/${id}`, { method: 'PATCH', body: data }),
  move: (id: string, newCheckIn: string, newCheckOut: string) =>
    apiRequest<any>(`/reservations/${id}/move`, { method: 'PATCH', body: { newCheckIn, newCheckOut } }),
  delete: (id: string) => apiRequest<any>(`/reservations/${id}`, { method: 'DELETE' }),
};

export const cleaningsApi = {
  getAll: (params?: { start?: string; end?: string; status?: string }) =>
    apiRequest<any[]>('/api/cleanings', { params }),
  update: (
    id: string,
    data: Partial<{ status: 'TODO' | 'DONE' | 'CANCELLED'; assignedToId: string | null; notes: string | null }>,
  ) => apiRequest<any>(`/api/cleanings/${id}`, { method: 'PATCH', body: data }),
};

export const calendarApi = {
  getCalendar: (
    start: string,
    end: string,
    filters?: { status?: string; source?: string; propertyId?: string; groupId?: string },
  ) =>
    apiRequest<any>('/api/calendar', { params: { start, end, ...(filters || {}) }, cache: 'no-store' }),
};

export const teamApi = {
  list: () => apiRequest<any>('/api/admin/team'),
  invite: (data: {
    email: string;
    role: 'ORG_ADMIN' | 'ACCOUNTANT' | 'MANAGER' | 'TECHNICIAN' | 'OPERATOR';
    permissions?: Record<string, boolean>;
  }) => apiRequest<any>('/api/admin/team/invite', { method: 'POST', body: data }),
  update: (
    memberId: string,
    data: {
      role?: 'ORG_ADMIN' | 'ACCOUNTANT' | 'MANAGER' | 'TECHNICIAN' | 'OPERATOR';
      permissions?: Record<string, boolean>;
    },
  ) => apiRequest<any>(`/api/admin/team/${memberId}`, { method: 'PATCH', body: data }),
  disable: (memberId: string) => apiRequest<any>(`/api/admin/team/${memberId}/disable`, { method: 'PATCH' }),
  updatePermissions: (memberId: string, permissions: Record<string, boolean>) =>
    apiRequest<any>(`/api/admin/team/${memberId}/permissions`, { method: 'PATCH', body: { permissions } }),
  acceptInvitation: (token: string, password: string) =>
    apiRequest<any>(`/api/auth/team-invitations/${token}/accept`, { method: 'POST', body: { password } }),
};

export const dashboardApi = {
  getMetrics: () => apiRequest<any>('/dashboard/metrics'),
};

export const managerApi = {
  getOverview: (params?: { date?: string; days?: number }) =>
    apiRequest<{
      date: string;
      range: { start: string; end: string };
      assignedPropertiesCount: number;
      today: {
        checkIns: Array<{
          reservationId: string;
          propertyId: string;
          propertyName: string;
          guestName: string;
          checkIn: string;
          checkOut: string;
          status: string;
          phone?: string | null;
        }>;
        checkOuts: Array<{
          reservationId: string;
          propertyId: string;
          propertyName: string;
          guestName: string;
          checkIn: string;
          checkOut: string;
          status: string;
          phone?: string | null;
        }>;
        cleanings: Array<{
          cleaningId: string;
          propertyId: string;
          propertyName: string;
          date: string;
          status: 'TODO' | 'DONE' | 'CANCELLED';
          notes?: string | null;
        }>;
      };
      upcoming: {
        reservations: Array<{
          reservationId: string;
          propertyName: string;
          guestName: string;
          checkIn: string;
          checkOut: string;
          status: string;
        }>;
      };
    }>('/api/manager/overview', { params }),
};

export const exportsApi = {
  exportProperties: () => apiRequest<Blob>('/api/exports/properties', { responseType: 'blob' }),
  exportReservations: (start: string, end: string) =>
    apiRequest<Blob>('/api/exports/reservations', { params: { start, end }, responseType: 'blob' }),
  exportCleanings: (start: string, end: string) =>
    apiRequest<Blob>('/api/exports/cleanings', { params: { start, end }, responseType: 'blob' }),
  exportClients: () => apiRequest<Blob>('/api/exports/clients', { responseType: 'blob' }),
  exportAdminBackup: (includeAuditLogs = true) =>
    apiRequest<Blob>('/api/admin/backup/export', {
      params: { includeAuditLogs },
      responseType: 'blob',
    }),
  exportSuperadminOrganizationBackup: (organizationId: string, includeAuditLogs = true) =>
    apiRequest<Blob>(`/api/superadmin/organizations/${organizationId}/backup/export`, {
      params: { includeAuditLogs },
      responseType: 'blob',
    }),
};

export const activityApi = {
  getAll: (params?: { limit?: number; entityType?: string; userId?: string }) =>
    apiRequest<any[]>('/api/activity', { params }),
};

export const channelsApi = {
  getSettings: () => apiRequest<any>('/api/channels/settings'),
  updatePropertyChannel: (
    propertyId: string,
    data: { channel: 'AIRBNB' | 'BOOKING' | 'DIRECT'; isEnabled?: boolean; icsUrl?: string; externalListingId?: string },
  ) => apiRequest<any>(`/api/channels/property/${propertyId}`, { method: 'PATCH', body: data }),
  syncIcal: (data?: { propertyId?: string; channel?: 'AIRBNB' | 'BOOKING' | 'DIRECT' }) =>
    apiRequest<any>('/api/channels/ical/sync', { method: 'POST', body: data ?? {} }),
};

export const feedbackApi = {
  create: (data: {
    type: 'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT';
    title: string;
    message: string;
    pageUrl?: string;
    screenshotUrl?: string;
  }) =>
    apiRequest<any>('/api/feedback', { method: 'POST', body: data }),
  list: () => apiRequest<any[]>('/api/feedback'),
  superadminList: (params?: {
    organizationId?: string;
    type?: 'BUG' | 'IDEA' | 'QUESTION' | 'COMPLAINT';
    status?: 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  }) => apiRequest<any[]>('/api/superadmin/feedback', { params }),
  superadminUpdate: (id: string, data: { status?: 'NEW' | 'REVIEWED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED'; priority?: 'LOW' | 'MEDIUM' | 'HIGH' }) =>
    apiRequest<any>(`/api/superadmin/feedback/${id}`, { method: 'PATCH', body: data }),
};

export const roadmapApi = {
  list: (params?: {
    status?: 'NEW' | 'UNDER_REVIEW' | 'PLANNED' | 'IN_PROGRESS' | 'RELEASED' | 'REJECTED';
    category?: 'PAYMENTS' | 'REPORTS' | 'MOBILE' | 'INTEGRATIONS' | 'UX' | 'OTHER';
  }) => apiRequest<any[]>('/api/roadmap/features', { params }),
  create: (data: {
    title: string;
    description: string;
    category: 'PAYMENTS' | 'REPORTS' | 'MOBILE' | 'INTEGRATIONS' | 'UX' | 'OTHER';
    visibility?: 'INTERNAL' | 'PUBLIC';
  }) => apiRequest<any>('/api/roadmap/features', { method: 'POST', body: data }),
  vote: (id: string) => apiRequest<any>(`/api/roadmap/features/${id}/vote`, { method: 'POST' }),
  unvote: (id: string) => apiRequest<any>(`/api/roadmap/features/${id}/vote`, { method: 'DELETE' }),
  superadminList: (params?: {
    status?: 'NEW' | 'UNDER_REVIEW' | 'PLANNED' | 'IN_PROGRESS' | 'RELEASED' | 'REJECTED';
    category?: 'PAYMENTS' | 'REPORTS' | 'MOBILE' | 'INTEGRATIONS' | 'UX' | 'OTHER';
  }) => apiRequest<any[]>('/api/superadmin/roadmap/features', { params }),
  superadminUpdate: (id: string, data: { status?: 'NEW' | 'UNDER_REVIEW' | 'PLANNED' | 'IN_PROGRESS' | 'RELEASED' | 'REJECTED'; visibility?: 'INTERNAL' | 'PUBLIC' }) =>
    apiRequest<any>(`/api/superadmin/roadmap/features/${id}`, { method: 'PATCH', body: data }),
};

export const releaseNotesApi = {
  list: () => apiRequest<any[]>('/api/release-notes'),
  unread: () => apiRequest<any[]>('/api/release-notes/unread'),
  markRead: (id: string) => apiRequest<any>(`/api/release-notes/${id}/read`, { method: 'PATCH' }),
  superadminList: (params?: { targetRole?: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT'; isPublished?: boolean }) =>
    apiRequest<any[]>('/api/superadmin/release-notes', {
      params: {
        targetRole: params?.targetRole,
        isPublished: params?.isPublished !== undefined ? String(params.isPublished) : undefined,
      },
    }),
  superadminCreate: (data: { title: string; content: string; version?: string; targetRole?: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT' }) =>
    apiRequest<any>('/api/superadmin/release-notes', { method: 'POST', body: data }),
  superadminUpdate: (
    id: string,
    data: Partial<{ title: string; content: string; version?: string; targetRole: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT'; isPublished: boolean }>,
  ) => apiRequest<any>(`/api/superadmin/release-notes/${id}`, { method: 'PATCH', body: data }),
  superadminDelete: (id: string) => apiRequest<any>(`/api/superadmin/release-notes/${id}`, { method: 'DELETE' }),
  superadminPublish: (id: string) => apiRequest<any>(`/api/superadmin/release-notes/${id}/publish`, { method: 'POST' }),
};

export const leadsApi = {
  createPublic: (data: {
    name: string;
    phone: string;
    email: string;
    associationName?: string;
    apartmentsCount?: number;
    city?: string;
    notes?: string;
  }) => apiRequest<any>('/api/public/leads', { method: 'POST', body: data }),
  superadminList: (params?: {
    city?: string;
    source?: 'WEBSITE' | 'MANUAL' | 'REFERRAL' | 'FACEBOOK' | 'OTHER';
    status?: 'NEW' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'TRIAL_STARTED' | 'WON' | 'LOST';
  }) => apiRequest<any[]>('/api/superadmin/leads', { params }),
  superadminCreate: (data: {
    name: string;
    phone: string;
    email: string;
    associationName?: string;
    apartmentsCount?: number;
    city?: string;
    source?: 'WEBSITE' | 'MANUAL' | 'REFERRAL' | 'FACEBOOK' | 'OTHER';
    notes?: string;
  }) => apiRequest<any>('/api/superadmin/leads', { method: 'POST', body: data }),
  superadminGet: (id: string) => apiRequest<any>(`/api/superadmin/leads/${id}`),
  superadminUpdate: (id: string, data: Partial<{
    name: string;
    phone: string;
    email: string;
    associationName: string;
    apartmentsCount: number;
    city: string;
    source: 'WEBSITE' | 'MANUAL' | 'REFERRAL' | 'FACEBOOK' | 'OTHER';
    notes: string;
    status: 'NEW' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'TRIAL_STARTED' | 'WON' | 'LOST';
  }>) =>
    apiRequest<any>(`/api/superadmin/leads/${id}`, { method: 'PATCH', body: data }),
  superadminDelete: (id: string) => apiRequest<any>(`/api/superadmin/leads/${id}`, { method: 'DELETE' }),
  superadminAddActivity: (
    id: string,
    data: { type: 'CALL' | 'EMAIL' | 'MEETING' | 'DEMO' | 'NOTE'; content: string },
  ) => apiRequest<any>(`/api/superadmin/leads/${id}/activities`, { method: 'POST', body: data }),
  superadminConvertToOrganization: (id: string, data?: { organizationName?: string }) =>
    apiRequest<any>(`/api/superadmin/leads/${id}/convert-to-organization`, { method: 'POST', body: data || {} }),
};

export const demoRequestsApi = {
  createPublic: (data: {
    name: string;
    phone: string;
    email: string;
    associationName?: string;
    apartmentsCount?: number;
    preferredDate?: string;
    preferredTime?: string;
    message?: string;
  }) => apiRequest<any>('/api/public/demo-requests', { method: 'POST', body: data }),
  superadminList: (params?: { status?: 'NEW' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' }) =>
    apiRequest<any[]>('/api/superadmin/demo-requests', { params }),
  superadminGet: (id: string) => apiRequest<any>(`/api/superadmin/demo-requests/${id}`),
  superadminUpdate: (
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      email: string;
      associationName: string;
      apartmentsCount: number;
      preferredDate: string;
      preferredTime: string;
      message: string;
      status: 'NEW' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
      scheduledAt: string;
      leadId: string | null;
    }>,
  ) => apiRequest<any>(`/api/superadmin/demo-requests/${id}`, { method: 'PATCH', body: data }),
  superadminSchedule: (id: string, data: { scheduledAt: string }) =>
    apiRequest<any>(`/api/superadmin/demo-requests/${id}/schedule`, { method: 'POST', body: data }),
  superadminComplete: (id: string) => apiRequest<any>(`/api/superadmin/demo-requests/${id}/complete`, { method: 'POST' }),
  superadminCancel: (id: string, data?: { status?: 'CANCELLED' | 'NO_SHOW' }) =>
    apiRequest<any>(`/api/superadmin/demo-requests/${id}/cancel`, { method: 'POST', body: data || {} }),
};

export const invitationsApi = {
  create: (data: {
    email: string;
    phone?: string;
    role: 'ADMIN' | 'RESIDENT' | 'MANAGER' | 'TENANT';
    apartmentId?: string;
    residentType?: 'OWNER' | 'TENANT' | 'CONTACT';
    locale?: 'ro' | 'ru' | 'en';
  }) => apiRequest<any>('/api/admin/invitations', { method: 'POST', body: data }),
  list: () => apiRequest<any[]>('/api/admin/invitations'),
  cancel: (id: string) => apiRequest<any>(`/api/admin/invitations/${id}/cancel`, { method: 'PATCH' }),
  revoke: (id: string) => apiRequest<any>(`/api/admin/invitations/${id}/cancel`, { method: 'PATCH' }),
  resend: (id: string) => apiRequest<any>(`/api/admin/invitations/${id}/resend`, { method: 'POST' }),
  getByToken: (token: string) => apiRequest<any>(`/api/auth/invitations/${token}`),
  acceptByToken: (token: string, password: string) =>
    apiRequest<any>(`/api/auth/invitations/${token}/accept`, { method: 'POST', body: { password } }),
  accept: (data: { token: string; password: string }) => apiRequest<any>('/api/invitations/accept', { method: 'POST', body: data }),
};

export const adminApi = {
  getCrmStats: () => apiRequest<any>('/admin/crm-stats'),
  getOrganizations: (search?: string) => apiRequest<any[]>('/admin/organizations', { params: search ? { search } : undefined }),
  getPlatformStats: () => apiRequest<any>('/admin/platform-stats'),
  getOrganizationDetail: (id: string) => apiRequest<any>(`/admin/organization/${id}`),
  updateOrganizationStatus: (id: string, isActive: boolean) =>
    apiRequest<any>(`/admin/organization/${id}/status`, { method: 'PATCH', body: { isActive } }),
  activateOrganization: (id: string) => apiRequest<any>(`/admin/organization/${id}/activate`, { method: 'PATCH' }),
  deactivateOrganization: (id: string) => apiRequest<any>(`/admin/organization/${id}/deactivate`, { method: 'PATCH' }),
  updateOrganizationPlan: (id: string, plan: string) =>
    apiRequest<any>(`/admin/organization/${id}/plan`, { method: 'PATCH', body: { plan } }),
  changePlan: (id: string, plan: string) =>
    apiRequest<any>(`/admin/organization/${id}/change-plan`, { method: 'PATCH', body: { plan } }),
  setCustomPrice: (id: string, customPrice: number) =>
    apiRequest<any>(`/admin/organization/${id}/custom-price`, { method: 'PATCH', body: { customPrice } }),
  setDiscount: (id: string, discountPercent: number) =>
    apiRequest<any>(`/admin/organization/${id}/discount`, { method: 'PATCH', body: { discountPercent } }),
  extendTrial: (id: string, body: { trialEndsAt?: string; extendDays?: number }) =>
    apiRequest<any>(`/admin/organization/${id}/extend-trial`, { method: 'PATCH', body }),
  markInvoicePaid: (invoiceId: string) => apiRequest<any>(`/admin/invoice/${invoiceId}/mark-paid`, { method: 'PATCH' }),
  setPropertyLimit: (id: string, propertyLimit: number) =>
    apiRequest<any>(`/admin/organization/${id}/property-limit`, { method: 'PATCH', body: { propertyLimit } }),
};

export const apartmentsApi = {
  list: () => apiRequest<any[]>('/apartments'),
  get: (id: string) => apiRequest<any>(`/apartments/${id}`),
  financialSummary: (id: string) => apiRequest<any>(`/apartments/${id}/financial-summary`),
  create: (data: {
    organizationId: string;
    buildingId: string;
    staircaseId: string;
    number: string;
    floor: number;
    areaM2: number;
    rooms?: number;
    status?: 'ACTIVE' | 'EMPTY' | 'DEBTOR' | 'PROBLEM';
  }) => apiRequest<any>('/apartments', { method: 'POST', body: data }),
  linkResident: (apartmentId: string, data: {
    residentId: string;
    role: 'OWNER' | 'RESIDENT' | 'TENANT' | 'FAMILY_MEMBER' | 'REPRESENTATIVE';
    isPrimary?: boolean;
  }) => apiRequest<any>(`/apartments/${apartmentId}/residents`, { method: 'POST', body: data }),
};

export const residentsApi = {
  list: () => apiRequest<any[]>('/residents'),
  get: (id: string) => apiRequest<any>(`/residents/${id}`),
  create: (data: {
    organizationId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    accountStatus?: 'CREATED' | 'INVITED' | 'NO_ACCOUNT';
  }) => apiRequest<any>('/residents', { method: 'POST', body: data }),
  createAccount: (residentId: string, data: { email: string; phone?: string; password: string }) =>
    apiRequest<any>(`/residents/${residentId}/create-account`, { method: 'POST', body: data }),
};

export const metersApi = {
  list: () => apiRequest<any[]>('/meters'),
  get: (id: string) => apiRequest<any>(`/meters/${id}`),
  create: (data: {
    organizationId: string;
    apartmentId: string;
    type: 'COLD_WATER' | 'HOT_WATER' | 'GAS' | 'ELECTRICITY' | 'HEATING';
    serialNumber: string;
    status?: 'ACTIVE' | 'MISSING_READING' | 'SUSPICIOUS' | 'INACTIVE';
  }) => apiRequest<any>('/meters', { method: 'POST', body: data }),
  addReading: (meterId: string, data: { value: number; readingDate?: string; source?: 'ADMIN' | 'RESIDENT' }) =>
    apiRequest<any>(`/meters/${meterId}/readings`, { method: 'POST', body: data }),
};

export const adminStructureApi = {
  listBuildings: () => apiRequest<any[]>('/admin/buildings'),
  createBuilding: (data: { name: string; address: string; cadastralNumber?: string; totalFloors: number }) =>
    apiRequest<any>('/admin/buildings', { method: 'POST', body: data }),
  getBuilding: (id: string) => apiRequest<any>(`/admin/buildings/${id}`),
  updateBuilding: (id: string, data: Partial<{ name: string; address: string; cadastralNumber: string; totalFloors: number }>) =>
    apiRequest<any>(`/admin/buildings/${id}`, { method: 'PATCH', body: data }),
  deleteBuilding: (id: string) => apiRequest<any>(`/admin/buildings/${id}`, { method: 'DELETE' }),

  listStaircases: (buildingId: string) => apiRequest<any[]>(`/admin/buildings/${buildingId}/staircases`),
  createStaircase: (buildingId: string, data: { name: string; floorsCount: number }) =>
    apiRequest<any>(`/admin/buildings/${buildingId}/staircases`, { method: 'POST', body: data }),
  updateStaircase: (id: string, data: Partial<{ name: string; floorsCount: number }>) =>
    apiRequest<any>(`/admin/staircases/${id}`, { method: 'PATCH', body: data }),
  deleteStaircase: (id: string) => apiRequest<any>(`/admin/staircases/${id}`, { method: 'DELETE' }),

  listApartments: (params?: { buildingId?: string; staircaseId?: string; floor?: number; status?: string; search?: string; page?: number; limit?: number }) =>
    apiRequest<any>('/admin/apartments', { params }),
  createApartment: (data: {
    buildingId: string;
    staircaseId: string;
    number: string;
    floor: number;
    areaM2: number;
    rooms?: number;
    status: 'OCCUPIED' | 'EMPTY' | 'RENTED';
  }) => apiRequest<any>('/admin/apartments', { method: 'POST', body: data }),
  updateApartment: (id: string, data: Partial<any>) => apiRequest<any>(`/admin/apartments/${id}`, { method: 'PATCH', body: data }),
  deleteApartment: (id: string) => apiRequest<any>(`/admin/apartments/${id}`, { method: 'DELETE' }),

  listResidents: () => apiRequest<any[]>('/admin/residents'),
  createResident: (data: {
    userId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    apartmentId: string;
    type: 'OWNER' | 'TENANT';
    phone?: string;
  }) => apiRequest<any>('/admin/residents', { method: 'POST', body: data }),
  updateResident: (id: string, data: Partial<{ apartmentId: string; type: 'OWNER' | 'TENANT'; phone: string }>) =>
    apiRequest<any>(`/admin/residents/${id}`, { method: 'PATCH', body: data }),
  deleteResident: (id: string) => apiRequest<any>(`/admin/residents/${id}`, { method: 'DELETE' }),
  listResidentProfiles: (params?: { page?: number; limit?: number }) => apiRequest<any>('/admin/resident-profiles', { params }),
  createResidentProfile: (data: {
    userId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    apartmentId: string;
    type: 'OWNER' | 'TENANT' | 'CONTACT';
    phone?: string;
    isPrimary?: boolean;
  }) => apiRequest<any>('/admin/resident-profiles', { method: 'POST', body: data }),
  updateResidentProfile: (id: string, data: Partial<{ apartmentId: string; type: 'OWNER' | 'TENANT' | 'CONTACT'; phone: string; isPrimary: boolean }>) =>
    apiRequest<any>(`/admin/resident-profiles/${id}`, { method: 'PATCH', body: data }),
  deleteResidentProfile: (id: string) => apiRequest<any>(`/admin/resident-profiles/${id}`, { method: 'DELETE' }),
};

export const communicationsApi = {
  listAdminAnnouncements: (params?: {
    contentType?: 'ANNOUNCEMENT' | 'DOCUMENT' | 'MAINTENANCE' | 'VOTE' | 'SYSTEM_NOTICE';
    importance?: 'NORMAL' | 'IMPORTANT' | 'URGENT';
    targetType?: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';
    pinned?: boolean;
  }) =>
    apiRequest<any[]>('/api/admin/announcements', {
      params: {
        contentType: params?.contentType,
        importance: params?.importance,
        targetType: params?.targetType,
        pinned: params?.pinned !== undefined ? String(params.pinned) : undefined,
      },
    }),
  createAdminAnnouncement: (data: {
    title: string;
    content: string;
    contentType?: 'ANNOUNCEMENT' | 'DOCUMENT' | 'MAINTENANCE' | 'VOTE' | 'SYSTEM_NOTICE';
    importance: 'NORMAL' | 'IMPORTANT' | 'URGENT';
    targetType: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';
    buildingId?: string;
    staircaseId?: string;
    apartmentId?: string;
    isPinned?: boolean;
    commentsEnabled?: boolean;
  }) => apiRequest<any>('/api/admin/announcements', { method: 'POST', body: data }),
  updateAdminAnnouncement: (id: string, data: any) =>
    apiRequest<any>(`/api/admin/announcements/${id}`, { method: 'PATCH', body: data }),
  deleteAdminAnnouncement: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),
  pinAdminAnnouncement: (id: string, isPinned?: boolean) =>
    apiRequest<any>(`/api/admin/announcements/${id}/pin`, { method: 'PATCH', body: { isPinned } }),
  toggleAdminAnnouncementComments: (id: string, commentsEnabled?: boolean) =>
    apiRequest<any>(`/api/admin/announcements/${id}/toggle-comments`, { method: 'PATCH', body: { commentsEnabled } }),

  listAdminDocuments: () => apiRequest<any[]>('/api/admin/documents'),
  createAdminDocument: (data: {
    title: string;
    description?: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
    targetType: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE' | 'APARTMENT';
    buildingId?: string;
    staircaseId?: string;
    apartmentId?: string;
  }) => apiRequest<any>('/api/admin/documents', { method: 'POST', body: data }),
  updateAdminDocument: (id: string, data: any) =>
    apiRequest<any>(`/api/admin/documents/${id}`, { method: 'PATCH', body: data }),
  deleteAdminDocument: (id: string) => apiRequest<any>(`/api/admin/documents/${id}`, { method: 'DELETE' }),

  listResidentAnnouncements: () => apiRequest<any[]>('/api/resident/announcements'),
  getResidentAnnouncement: (id: string) => apiRequest<any>(`/api/resident/announcements/${id}`),
  listResidentAnnouncementComments: (announcementId: string) =>
    apiRequest<any[]>(`/api/resident/announcements/${announcementId}/comments`),
  createResidentAnnouncementComment: (announcementId: string, data: { content: string }) =>
    apiRequest<any>(`/api/resident/announcements/${announcementId}/comments`, { method: 'POST', body: data }),
  updateResidentAnnouncementComment: (id: string, data: { content: string }) =>
    apiRequest<any>(`/api/resident/announcement-comments/${id}`, { method: 'PATCH', body: data }),
  deleteResidentAnnouncementComment: (id: string) =>
    apiRequest<any>(`/api/resident/announcement-comments/${id}`, { method: 'DELETE' }),
  listResidentDocuments: () => apiRequest<any[]>('/api/resident/documents'),
  listResidentNotifications: () => apiRequest<any[]>('/api/resident/notifications'),
  markResidentNotificationRead: (id: string) => apiRequest<any>(`/api/resident/notifications/${id}/read`, { method: 'PATCH' }),
  markResidentNotificationsReadAll: () => apiRequest<any>('/api/resident/notifications/read-all', { method: 'PATCH' }),

  getSuperadminActivity: () => apiRequest<any[]>('/api/superadmin/activity'),
  listAdminAnnouncementComments: (announcementId: string) =>
    apiRequest<any[]>(`/api/admin/announcements/${announcementId}/comments`),
  hideAdminAnnouncementComment: (id: string) =>
    apiRequest<any>(`/api/admin/announcement-comments/${id}/hide`, { method: 'PATCH' }),
  showAdminAnnouncementComment: (id: string) =>
    apiRequest<any>(`/api/admin/announcement-comments/${id}/show`, { method: 'PATCH' }),
  deleteAdminAnnouncementComment: (id: string) =>
    apiRequest<any>(`/api/admin/announcement-comments/${id}`, { method: 'DELETE' }),
};

export const issuesApi = {
  list: () => apiRequest<any[]>('/issues'),
  get: (id: string) => apiRequest<any>(`/issues/${id}`),
  updateStatus: (id: string, status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED') =>
    apiRequest<any>(`/issues/${id}/status`, { method: 'PATCH', body: { status } }),
  residentList: (params?: { status?: 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED' }) =>
    apiRequest<any[]>('/api/resident/issues', { params }),
  residentCreate: (data: {
    apartmentId?: string;
    buildingId?: string;
    staircaseId?: string;
    title: string;
    description: string;
    category: 'WATER' | 'ELECTRICITY' | 'ELEVATOR' | 'CLEANING' | 'HEATING' | 'SECURITY' | 'OTHER';
    locationType: 'APARTMENT' | 'BUILDING' | 'STAIRCASE' | 'COMMON_AREA';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }) => apiRequest<any>('/api/resident/issues', { method: 'POST', body: data }),
  residentGetOne: (id: string) => apiRequest<any>(`/api/resident/issues/${id}`),
  residentAddComment: (id: string, data: { message: string }) =>
    apiRequest<any>(`/api/resident/issues/${id}/comments`, { method: 'POST', body: data }),
  residentAddAttachment: (id: string, data: { fileUrl: string; fileName: string; fileType: string }) =>
    apiRequest<any>(`/api/resident/issues/${id}/attachments`, { method: 'POST', body: data }),

  adminList: (params?: {
    status?: 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    category?: 'WATER' | 'ELECTRICITY' | 'ELEVATOR' | 'CLEANING' | 'HEATING' | 'SECURITY' | 'OTHER';
    buildingId?: string;
    staircaseId?: string;
    apartmentId?: string;
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/issues', { params }),
  adminGetOne: (id: string) => apiRequest<any>(`/api/admin/issues/${id}`),
  adminUpdate: (id: string, data: { status?: string; priority?: string; assignedToUserId?: string | null }) =>
    apiRequest<any>(`/api/admin/issues/${id}`, { method: 'PATCH', body: data }),
  adminAddComment: (id: string, data: { message: string; isInternal?: boolean }) =>
    apiRequest<any>(`/api/admin/issues/${id}/comments`, { method: 'POST', body: data }),
  adminDelete: (id: string) => apiRequest<any>(`/api/admin/issues/${id}`, { method: 'DELETE' }),

  superadminOverview: () => apiRequest<any>('/api/superadmin/issues/overview'),
};

export const announcementsApi = {
  list: () => apiRequest<any[]>('/announcements'),
  get: (id: string) => apiRequest<any>(`/announcements/${id}`),
  create: (data: {
    organizationId: string;
    title: string;
    content: string;
    category?: 'GENERAL' | 'REPAIR' | 'URGENT' | 'ADMINISTRATION';
    status?: 'ACTIVE' | 'ARCHIVED';
  }) => apiRequest<any>('/announcements', { method: 'POST', body: data }),
};

export const residentDemoApi = {
  context: () => apiRequest<any>('/resident/me'),
  invoices: () => apiRequest<any[]>('/resident/invoices'),
  payments: () => apiRequest<any[]>('/resident/payments'),
  meters: () => apiRequest<any[]>('/resident/meters'),
  addMeterReading: (meterId: string, data: { value: number; readingDate?: string; source?: 'RESIDENT' }) =>
    apiRequest<any>(`/resident/meters/${meterId}/readings`, { method: 'POST', body: data }),
  issues: () => apiRequest<any[]>('/resident/issues'),
  createIssue: (data: {
    category: 'WATER' | 'HEATING' | 'CLEANING' | 'ELEVATOR' | 'REPAIR' | 'OTHER';
    priority?: 'NORMAL' | 'IMPORTANT' | 'URGENT';
    title: string;
    description: string;
  }) => apiRequest<any>('/resident/issues', { method: 'POST', body: data }),
  announcements: () => apiRequest<any[]>('/resident/announcements'),
};

export const votesApi = {
  adminList: (params?: { status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'PUBLISHED' }) =>
    apiRequest<any[]>('/api/admin/votes', { params }),
  adminCreate: (data: {
    title: string;
    description: string;
    targetType: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE';
    buildingId?: string;
    staircaseId?: string;
    votingMethod: 'BY_APARTMENT' | 'BY_AREA_M2';
    startsAt: string;
    endsAt: string;
  }) => apiRequest<any>('/api/admin/votes', { method: 'POST', body: data }),
  adminGetOne: (id: string) => apiRequest<any>(`/api/admin/votes/${id}`),
  adminUpdate: (id: string, data: any) => apiRequest<any>(`/api/admin/votes/${id}`, { method: 'PATCH', body: data }),
  adminAddOption: (id: string, label: string) =>
    apiRequest<any>(`/api/admin/votes/${id}/options`, { method: 'POST', body: { label } }),
  adminActivate: (id: string) => apiRequest<any>(`/api/admin/votes/${id}/activate`, { method: 'POST' }),
  adminClose: (id: string) => apiRequest<any>(`/api/admin/votes/${id}/close`, { method: 'POST' }),
  adminPublish: (id: string) => apiRequest<any>(`/api/admin/votes/${id}/publish`, { method: 'POST' }),
  adminResults: (id: string) => apiRequest<any>(`/api/admin/votes/${id}/results`),

  residentList: () => apiRequest<any[]>('/api/resident/votes'),
  residentGetOne: (id: string) => apiRequest<any>(`/api/resident/votes/${id}`),
  residentCast: (id: string, data: { apartmentId: string; voteOptionId: string }) =>
    apiRequest<any>(`/api/resident/votes/${id}/cast`, { method: 'POST', body: data }),

  superadminOverview: () => apiRequest<any>('/api/superadmin/votes/overview'),
};

export const reportsApi = {
  adminMonthly: (params?: { month?: number; year?: number }) => apiRequest<any>('/api/admin/reports/monthly', { params }),
  adminDebts: (params?: { buildingId?: string; staircaseId?: string; floor?: number; minDebt?: number; maxDebt?: number }) =>
    apiRequest<any[]>('/api/admin/reports/debts', { params }),
  adminPayments: (params?: { from?: string; to?: string }) => apiRequest<any[]>('/api/admin/reports/payments', { params }),
  adminCharges: (params?: { month?: number; year?: number }) => apiRequest<any[]>('/api/admin/reports/charges', { params }),
  residentStatement: (params?: { apartmentId?: string }) => apiRequest<any>('/api/resident/reports/statement', { params }),
  superadminPlatform: () => apiRequest<any>('/api/superadmin/reports/platform'),

  adminMonthlyPdf: (params?: { month?: number; year?: number }) =>
    apiRequest<Blob>('/api/admin/reports/monthly/export/pdf', { params, responseType: 'blob' }),
  adminMonthlyXlsx: (params?: { month?: number; year?: number }) =>
    apiRequest<Blob>('/api/admin/reports/monthly/export/xlsx', { params, responseType: 'blob' }),
  adminDebtsPdf: (params?: any) => apiRequest<Blob>('/api/admin/reports/debts/export/pdf', { params, responseType: 'blob' }),
  adminDebtsXlsx: (params?: any) => apiRequest<Blob>('/api/admin/reports/debts/export/xlsx', { params, responseType: 'blob' }),
  adminPaymentsXlsx: (params?: { from?: string; to?: string }) =>
    apiRequest<Blob>('/api/admin/reports/payments/export/xlsx', { params, responseType: 'blob' }),
  residentStatementPdf: (params?: { apartmentId?: string }) =>
    apiRequest<Blob>('/api/resident/reports/statement/export/pdf', { params, responseType: 'blob' }),
  superadminPlatformXlsx: () => apiRequest<Blob>('/api/superadmin/reports/platform/export/xlsx', { responseType: 'blob' }),
};

export const importsApi = {
  list: () => apiRequest<any[]>('/api/admin/imports'),
  preview: (id: string) => apiRequest<any>(`/api/admin/imports/${id}/preview`),
  confirm: (id: string) => apiRequest<any>(`/api/admin/imports/${id}/confirm`, { method: 'POST' }),
  downloadTemplate: (type: 'BUILDINGS' | 'STAIRCASES' | 'APARTMENTS' | 'RESIDENTS' | 'INITIAL_BALANCES') =>
    apiRequest<Blob>(`/api/admin/imports/templates/${type}`, { responseType: 'blob' }),
  upload: async (type: 'BUILDINGS' | 'STAIRCASES' | 'APARTMENTS' | 'RESIDENTS' | 'INITIAL_BALANCES', file: File) => {
    const apiUrl = requireApiUrl();
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', file);
    const response = await fetch(`${apiUrl}/api/admin/imports/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...getOrgScopeHeader('/api/admin/imports/upload') },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    const json = await response.json();
    return { data: json?.data ?? json };
  },
};

export const invoicesApi = {
  list: () => apiRequest<any[]>('/invoices'),
  get: (id: string) => apiRequest<any>(`/invoices/${id}`),
  create: (data: {
    organizationId: string;
    apartmentId: string;
    month: number;
    year: number;
    amount: number;
    status?: 'PAID' | 'UNPAID' | 'OVERDUE';
    dueDate: string;
  }) => apiRequest<any>('/invoices', { method: 'POST', body: data }),
  updateStatus: (id: string, data: { status: 'PAID' | 'UNPAID' | 'OVERDUE' }) =>
    apiRequest<any>(`/invoices/${id}/status`, { method: 'PATCH', body: data }),
  generateMonthly: (data: { month: number; year: number; dueDate?: string }) =>
    apiRequest<any>('/api/admin/invoices/generate-monthly', { method: 'POST', body: data }),
  monthlySummary: (params: { month: number; year: number }) =>
    apiRequest<any>('/api/admin/invoices/monthly-summary', { params }),
  adminList: (params?: { month?: number; year?: number; buildingId?: string; staircaseId?: string; status?: string; page?: number; limit?: number }) =>
    apiRequest<any>('/api/admin/invoices', { params }),
  adminGetOne: (id: string) => apiRequest<any>(`/api/admin/invoices/${id}`),
  issue: (id: string) => apiRequest<any>(`/api/admin/invoices/${id}/issue`, { method: 'POST' }),
  regenerate: (id: string) => apiRequest<any>(`/api/admin/invoices/${id}/regenerate`, { method: 'POST' }),
  adminPdf: (id: string) => apiRequest<Blob>(`/api/admin/invoices/${id}/pdf`, { responseType: 'blob' }),
  sendReminders: (data: { month: number; year: number; status?: string; message?: string }) =>
    apiRequest<any>('/api/admin/invoices/send-reminders', { method: 'POST', body: data }),
  adminReminderHistory: () => apiRequest<any[]>('/api/admin/reminders'),
  adminReceipts: () => apiRequest<any[]>('/api/admin/receipts'),
  adminReceiptPdf: (id: string) => apiRequest<Blob>(`/api/admin/receipts/${id}/pdf`, { responseType: 'blob' }),

  residentList: () => apiRequest<any[]>('/api/resident/invoices'),
  residentGetOne: (id: string) => apiRequest<any>(`/api/resident/invoices/${id}`),
  residentPdf: (id: string) => apiRequest<Blob>(`/api/resident/invoices/${id}/pdf`, { responseType: 'blob' }),
  residentReceipts: () => apiRequest<any[]>('/api/resident/receipts'),
  residentReceiptPdf: (id: string) => apiRequest<Blob>(`/api/resident/receipts/${id}/pdf`, { responseType: 'blob' }),
};

export const tariffsApi = {
  list: () => apiRequest<any[]>('/api/admin/tariffs'),
  create: (data: {
    name: string;
    type: 'PER_M2' | 'FIXED';
    amount: number;
    currency?: 'MDL';
    isActive?: boolean;
    code?: string;
  }) => apiRequest<any>('/api/admin/tariffs', { method: 'POST', body: data }),
  update: (
    id: string,
    data: {
      name?: string;
      type?: 'PER_M2' | 'FIXED';
      amount: number;
      currency?: 'MDL';
      isActive?: boolean;
    },
  ) => apiRequest<any>(`/api/admin/tariffs/${id}`, { method: 'PATCH', body: data }),
  deactivate: (id: string) => apiRequest<any>(`/api/admin/tariffs/${id}`, { method: 'DELETE' }),
};

export const financeApi = {
  overview: () => apiRequest<any>('/api/admin/finance-overview'),
};

export const paymentsApi = {
  list: () => apiRequest<any[]>('/payments'),
  get: (id: string) => apiRequest<any>(`/payments/${id}`),
  summary: () => apiRequest<any>('/billing/summary'),
  create: (data: {
    organizationId: string;
    apartmentId: string;
    invoiceId?: string;
    amount: number;
    method: 'CASH' | 'BANK' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE';
    paidAt?: string;
  }) => apiRequest<any>('/payments', { method: 'POST', body: data }),
  adminList: (params?: {
    buildingId?: string;
    staircaseId?: string;
    apartmentId?: string;
    method?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/payments', { params }),
  adminManual: (data: {
    apartmentId: string;
    invoiceId?: string;
    amount: number;
    method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE';
    note?: string;
  }) => apiRequest<any>('/api/admin/payments/manual', { method: 'POST', body: data }),
  adminConfirm: (id: string) => apiRequest<any>(`/api/admin/payments/${id}/confirm`, { method: 'PATCH' }),
  adminCancel: (id: string) => apiRequest<any>(`/api/admin/payments/${id}/cancel`, { method: 'PATCH' }),
  adminProviderList: () => apiRequest<any[]>('/api/admin/payment-providers'),
  adminProviderUpdate: (
    provider: 'MAIB' | 'PAYNET' | 'OPLATA' | 'MANUAL_BANK_TRANSFER' | 'CASH',
    data: { isEnabled?: boolean; isTestMode?: boolean; configJson?: Record<string, any> },
  ) => apiRequest<any>(`/api/admin/payment-providers/${provider}`, { method: 'PATCH', body: data }),

  residentList: () => apiRequest<any[]>('/api/resident/payments'),
  residentProviderList: () => apiRequest<any[]>('/api/resident/payment-providers'),
  residentCreateIntent: (data: {
    apartmentId: string;
    invoiceId?: string;
    amount: number;
    provider: 'MAIB' | 'PAYNET' | 'OPLATA' | 'MANUAL_BANK_TRANSFER' | 'CASH';
  }) => apiRequest<any>('/api/resident/payments/create-intent', { method: 'POST', body: data }),
  residentStatus: (id: string) => apiRequest<any>(`/api/resident/payments/${id}/status`),
};

export const organizationSettingsApi = {
  adminGet: () =>
    apiRequest<{
      id: string;
      name: string;
      legalName?: string | null;
      fiscalCode?: string | null;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      bankName?: string | null;
      bankAccountIban?: string | null;
      bankSwift?: string | null;
      paymentInstructions?: string | null;
      treasurerName?: string | null;
      administratorName?: string | null;
      logoUrl?: string | null;
      primaryColor?: string | null;
      invoicePrefix?: string | null;
      receiptPrefix?: string | null;
      defaultCurrency: 'MDL' | 'EUR' | 'USD';
    }>('/api/admin/organization/settings'),
  adminUpdate: (data: Partial<any>) => apiRequest<any>('/api/admin/organization/settings', { method: 'PATCH', body: data }),
  residentPublicInfo: () =>
    apiRequest<{
      name: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      bankName?: string | null;
      bankAccountIban?: string | null;
      bankSwift?: string | null;
      paymentInstructions?: string | null;
      administratorName?: string | null;
      logoUrl?: string | null;
      primaryColor?: string | null;
    }>('/api/resident/organization/public-info'),
  superadminGet: (organizationId: string) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/settings`),
  superadminUpdate: (organizationId: string, data: Partial<any>) =>
    apiRequest<any>(`/api/superadmin/organizations/${organizationId}/settings`, { method: 'PATCH', body: data }),
};

export const privacyApi = {
  adminGet: () => apiRequest<any>('/api/admin/settings/privacy'),
  adminUpdate: (data: Partial<{
    showResidentNamesInCommunity: boolean;
    showApartmentNumbersInCommunity: boolean;
    allowResidentsToContactEachOther: boolean;
    showIssueReporterName: boolean;
    showVoteParticipants: boolean;
  }>) => apiRequest<any>('/api/admin/settings/privacy', { method: 'PATCH', body: data }),
  residentGet: () => apiRequest<any>('/api/resident/privacy-settings'),
};

export const maintenanceApi = {
  suppliersList: (params?: { search?: string }) => apiRequest<any[]>('/api/admin/suppliers', { params }),
  suppliersCreate: (data: {
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    serviceType?: string;
  }) => apiRequest<any>('/api/admin/suppliers', { method: 'POST', body: data }),
  suppliersUpdate: (id: string, data: any) => apiRequest<any>(`/api/admin/suppliers/${id}`, { method: 'PATCH', body: data }),
  suppliersDelete: (id: string) => apiRequest<any>(`/api/admin/suppliers/${id}`, { method: 'DELETE' }),

  tasksList: (params?: { status?: string; priority?: string; assignedTo?: string; buildingId?: string }) =>
    apiRequest<any[]>('/api/admin/maintenance/tasks', { params }),
  tasksCreate: (data: any) => apiRequest<any>('/api/admin/maintenance/tasks', { method: 'POST', body: data }),
  tasksUpdate: (id: string, data: any) => apiRequest<any>(`/api/admin/maintenance/tasks/${id}`, { method: 'PATCH', body: data }),
  tasksDelete: (id: string) => apiRequest<any>(`/api/admin/maintenance/tasks/${id}`, { method: 'DELETE' }),
  eventsList: (params?: { status?: string; from?: string; to?: string }) =>
    apiRequest<any[]>('/api/admin/maintenance/events', { params }),
  eventsCreate: (data: any) => apiRequest<any>('/api/admin/maintenance/events', { method: 'POST', body: data }),
  eventsUpdate: (id: string, data: any) => apiRequest<any>(`/api/admin/maintenance/events/${id}`, { method: 'PATCH', body: data }),
  eventsDelete: (id: string) => apiRequest<any>(`/api/admin/maintenance/events/${id}`, { method: 'DELETE' }),
  residentEventsList: (params?: { status?: string; from?: string; to?: string }) =>
    apiRequest<any[]>('/api/resident/maintenance/events', { params }),
  taskFromIssue: (issueId: string, data?: any) =>
    apiRequest<any>(`/api/admin/issues/${issueId}/maintenance-task`, { method: 'POST', body: data || {} }),

  technicianTasks: () => apiRequest<any[]>('/api/technician/tasks'),
  technicianUpdateTask: (id: string, data: { status?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; notes?: string }) =>
    apiRequest<any>(`/api/technician/tasks/${id}`, { method: 'PATCH', body: data }),

  expensesList: (params?: { category?: string; supplier?: string; from?: string; to?: string }) =>
    apiRequest<any[]>('/api/admin/expenses', { params }),
  expensesCreate: (data: any) => apiRequest<any>('/api/admin/expenses', { method: 'POST', body: data }),
  expensesUpdate: (id: string, data: any) => apiRequest<any>(`/api/admin/expenses/${id}`, { method: 'PATCH', body: data }),
  expensesDelete: (id: string) => apiRequest<any>(`/api/admin/expenses/${id}`, { method: 'DELETE' }),
  expenseAttachment: (id: string, data: { fileUrl: string; fileName: string }) =>
    apiRequest<any>(`/api/admin/expenses/${id}/attachments`, { method: 'POST', body: data }),
};

export const supportChatApi = {
  residentListConversations: () => apiRequest<any[]>('/api/resident/chat/conversations'),
  residentCreateConversation: (data?: { apartmentId?: string }) =>
    apiRequest<any>('/api/resident/chat/conversations', { method: 'POST', body: data || {} }),
  residentGetMessages: (conversationId: string) =>
    apiRequest<any[]>(`/api/resident/chat/conversations/${conversationId}/messages`),
  residentSendMessage: (conversationId: string, data: { content: string; messageType?: 'TEXT' | 'FILE' | 'SYSTEM'; fileAssetId?: string }) =>
    apiRequest<any>(`/api/resident/chat/conversations/${conversationId}/messages`, { method: 'POST', body: data }),
  residentMarkRead: (conversationId: string) =>
    apiRequest<any>(`/api/resident/chat/conversations/${conversationId}/read`, { method: 'PATCH' }),

  adminListConversations: (params?: { status?: 'OPEN' | 'PENDING' | 'CLOSED'; assignedToMe?: boolean }) =>
    apiRequest<any[]>('/api/admin/chat/conversations', {
      params: { status: params?.status, assignedToMe: params?.assignedToMe !== undefined ? String(params.assignedToMe) : undefined },
    }),
  adminGetMessages: (conversationId: string) =>
    apiRequest<any[]>(`/api/admin/chat/conversations/${conversationId}/messages`),
  adminSendMessage: (conversationId: string, data: { content: string; messageType?: 'TEXT' | 'FILE' | 'SYSTEM'; fileAssetId?: string }) =>
    apiRequest<any>(`/api/admin/chat/conversations/${conversationId}/messages`, { method: 'POST', body: data }),
  adminAssignConversation: (conversationId: string, data: { assignedToUserId?: string | null }) =>
    apiRequest<any>(`/api/admin/chat/conversations/${conversationId}/assign`, { method: 'PATCH', body: data }),
  adminUpdateConversationStatus: (conversationId: string, data: { status: 'OPEN' | 'PENDING' | 'CLOSED' }) =>
    apiRequest<any>(`/api/admin/chat/conversations/${conversationId}/status`, { method: 'PATCH', body: data }),
  adminMarkRead: (conversationId: string) =>
    apiRequest<any>(`/api/admin/chat/conversations/${conversationId}/read`, { method: 'PATCH' }),

  residentListCommunity: () => apiRequest<any[]>('/api/resident/chat/community'),
  residentGetCommunityMessages: (conversationId: string) => apiRequest<any[]>(`/api/resident/chat/community/${conversationId}/messages`),
  residentSendCommunityMessage: (conversationId: string, data: { content: string; messageType?: 'TEXT' | 'FILE' | 'SYSTEM'; fileAssetId?: string }) =>
    apiRequest<any>(`/api/resident/chat/community/${conversationId}/messages`, { method: 'POST', body: data }),

  adminListCommunity: () => apiRequest<any[]>('/api/admin/chat/community'),
  adminCreateCommunity: (data: {
    targetType: 'ORGANIZATION' | 'BUILDING' | 'STAIRCASE';
    buildingId?: string;
    staircaseId?: string;
    title?: string;
    isDefault?: boolean;
  }) =>
    apiRequest<any>('/api/admin/chat/community', {
      method: 'POST',
      body: {
        ...data,
        isDefault: data.isDefault !== undefined ? String(data.isDefault) : undefined,
      },
    }),
  adminGetCommunityMessages: (conversationId: string) => apiRequest<any[]>(`/api/admin/chat/community/${conversationId}/messages`),
  adminSendCommunityMessage: (conversationId: string, data: { content: string; messageType?: 'TEXT' | 'FILE' | 'SYSTEM'; fileAssetId?: string }) =>
    apiRequest<any>(`/api/admin/chat/community/${conversationId}/messages`, { method: 'POST', body: data }),
  adminHideMessage: (messageId: string) => apiRequest<any>(`/api/admin/chat/messages/${messageId}/hide`, { method: 'PATCH' }),
  adminDeleteMessage: (messageId: string) => apiRequest<any>(`/api/admin/chat/messages/${messageId}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  adminList: (params?: { type?: string }) => apiRequest<any[]>('/api/admin/notifications', { params }),
  adminTest: (data: { title: string; message: string; type?: string }) =>
    apiRequest<any>('/api/admin/notifications/test', { method: 'POST', body: data }),

  adminGetIntegrations: () => apiRequest<any>('/api/admin/integrations'),
  adminUpdateEmailIntegration: (data: { provider: 'SMTP' | 'SENDGRID' | 'OTHER'; configJson?: any; isActive: boolean }) =>
    apiRequest<any>('/api/admin/integrations/email', { method: 'PATCH', body: data }),
  adminUpdateTelegramIntegration: (data: { botToken: string; isActive: boolean }) =>
    apiRequest<any>('/api/admin/integrations/telegram', { method: 'PATCH', body: data }),
  adminUpdateSmsIntegration: (data: { provider: 'TWILIO' | 'OTHER'; configJson?: any; isActive: boolean }) =>
    apiRequest<any>('/api/admin/integrations/sms', { method: 'PATCH', body: data }),

  residentList: () => apiRequest<any[]>('/api/resident/notifications'),
  residentRead: (id: string) => apiRequest<any>(`/api/resident/notifications/${id}/read`, { method: 'PATCH' }),
  residentReadAll: () => apiRequest<any>('/api/resident/notifications/read-all', { method: 'PATCH' }),
  residentPreferences: () => apiRequest<any>('/api/resident/notification-preferences'),
  residentUpdatePreferences: (data: {
    emailEnabled?: boolean;
    telegramEnabled?: boolean;
    smsEnabled?: boolean;
    inAppEnabled?: boolean;
  }) => apiRequest<any>('/api/resident/notification-preferences', { method: 'PATCH', body: data }),
  residentGenerateTelegramToken: () =>
    apiRequest<any>('/api/resident/notification-preferences/telegram-connect-token', { method: 'POST' }),
  pushSubscribe: (data: { endpoint: string; p256dh: string; auth: string }) =>
    apiRequest<any>('/api/notifications/push/subscribe', { method: 'POST', body: data }),
  pushDisable: (id: string) => apiRequest<any>(`/api/notifications/push/${id}/disable`, { method: 'PATCH' }),
  pushStatus: () =>
    apiRequest<{
      enabled: boolean;
      activeCount: number;
      subscriptions: Array<{ id: string; endpoint: string; isActive: boolean; organizationId?: string | null }>;
    }>('/api/notifications/push/status'),
};

export const auditLogsApi = {
  adminList: (params?: { action?: string; entityType?: string; userId?: string; from?: string; to?: string }) =>
    apiRequest<any[]>('/api/admin/audit-logs', { params }),
  superadminList: (params?: {
    organizationId?: string;
    action?: string;
    entityType?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) => apiRequest<any[]>('/api/superadmin/audit-logs', { params }),
};

export const systemMonitoringApi = {
  reportClientError: (data: { message: string; stack?: string; metadataJson?: Record<string, any> }) =>
    apiRequest<any>('/api/system/errors/client', { method: 'POST', body: data }),
  health: () =>
    apiRequest<{
      status?: string;
      service?: string;
      ok?: boolean;
      time?: string;
      timestamp?: string;
      database?: 'UP' | 'DOWN' | string;
      version?: string;
      environment?: string;
    }>('/health'),
  healthDb: () =>
    apiRequest<{
      status: string;
      database: string;
      counts: {
        organizations: number;
        users: number;
        apartments: number;
      };
    }>('/health/db'),
  superadminListErrors: (params?: {
    source?: 'BACKEND' | 'FRONTEND' | 'JOB' | 'WEBHOOK' | 'PAYMENT_PROVIDER';
    level?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    resolved?: boolean;
    organizationId?: string;
  }) =>
    apiRequest<any[]>('/api/superadmin/system/errors', {
      params: {
        source: params?.source,
        level: params?.level,
        resolved: params?.resolved !== undefined ? String(params.resolved) : undefined,
        organizationId: params?.organizationId,
      },
    }),
  superadminResolveError: (id: string) => apiRequest<any>(`/api/superadmin/system/errors/${id}/resolve`, { method: 'PATCH' }),
  superadminSystemStatus: () =>
    apiRequest<{
      checkedAt: string;
      apiStatus: 'UP' | 'DOWN';
      databaseStatus: 'UP' | 'DOWN';
      failedJobsCount: number;
      unresolvedErrorsCount: number;
      storageSummary: {
        totalFiles: number;
        totalUsedBytes: number;
        totalUsedMb: number;
        organizationsWithFiles: number;
      };
      activeOrganizationsCount: number;
      lastSuccessfulScheduledJobRun: { jobName: string; lastRunAt: string } | null;
      appVersion: string;
      environment: string;
    }>('/api/superadmin/system/status'),
};

export const billingSaasApi = {
  listSuperadminSubscriptions: (status?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED') =>
    apiRequest<any[]>('/api/superadmin/subscriptions', { params: status ? { status } : undefined }),
  upsertOrganizationSubscription: (
    organizationId: string,
    data: {
      planId?: string | null;
      billingType: 'PER_APARTMENT' | 'PER_M2' | 'FIXED';
      price: number;
      currency: 'MDL' | 'EUR' | 'USD';
      trialStartDate?: string | null;
      trialEndDate?: string | null;
      subscriptionStartDate?: string | null;
      nextBillingDate?: string | null;
      status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
      notes?: string | null;
    },
  ) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/subscription`, { method: 'POST', body: data }),
  getOrganizationSubscription: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/organizations/${organizationId}/subscription`),
  patchSubscription: (
    id: string,
    data: Partial<{
      billingType: 'PER_APARTMENT' | 'PER_M2' | 'FIXED';
      price: number;
      currency: 'MDL' | 'EUR' | 'USD';
      trialStartDate: string | null;
      trialEndDate: string | null;
      nextBillingDate: string | null;
      status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
      notes: string | null;
    }>,
  ) => apiRequest<any>(`/api/superadmin/subscriptions/${id}`, { method: 'PATCH', body: data }),
  generateInvoice: (id: string, data?: { periodStart?: string; periodEnd?: string }) =>
    apiRequest<any>(`/api/superadmin/subscriptions/${id}/generate-invoice`, { method: 'POST', body: data || {} }),
  markInvoicePaid: (id: string) => apiRequest<any>(`/api/superadmin/invoices/${id}/mark-paid`, { method: 'PATCH' }),
  quickAction: (
    id: string,
    action: 'START_TRIAL' | 'EXTEND_TRIAL_30' | 'MARK_ACTIVE' | 'MARK_PAST_DUE' | 'SUSPEND' | 'CANCEL',
  ) => apiRequest<any>(`/api/superadmin/subscriptions/${id}/quick-action`, { method: 'POST', body: { action } }),
  getAdminSubscription: () => apiRequest<any>('/api/admin/subscription'),
  getAdminSubscriptionStatus: () => apiRequest<any>('/api/admin/subscription/status'),
  getAdminSubscriptionInvoices: () => apiRequest<any[]>('/api/admin/subscription/invoices'),
  superadminBillingInvoices: () => apiRequest<any[]>('/api/superadmin/billing/invoices'),
  superadminGenerateBilling: () => apiRequest<any>('/api/superadmin/billing/generate', { method: 'POST' }),
  superadminBillingInvoiceById: (id: string) => apiRequest<any>(`/api/superadmin/billing/invoices/${id}`),
  superadminMarkBillingInvoicePaid: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/invoices/${id}/mark-paid`, { method: 'PATCH' }),
  superadminBillingPayments: () => apiRequest<any[]>('/api/superadmin/billing/payments'),
  superadminCreateBillingPayment: (data: {
    organizationId: string;
    invoiceId?: string;
    amount: number;
    currency: 'MDL' | 'EUR' | 'USD';
    method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
    status?: 'PENDING' | 'CONFIRMED' | 'FAILED';
    note?: string;
  }) => apiRequest<any>('/api/superadmin/billing/payments', { method: 'POST', body: data }),
  superadminTrials: () => apiRequest<any[]>('/api/superadmin/trials'),
  superadminConvertTrial: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/trials/${organizationId}/convert`, { method: 'POST' }),
  superadminExtendTrial: (organizationId: string, days: number) =>
    apiRequest<any>(`/api/superadmin/trials/${organizationId}/extend`, { method: 'POST', body: { days } }),
  superadminMarkTrialLost: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/trials/${organizationId}/mark-lost`, { method: 'POST' }),
};

export const schedulerApi = {
  superadminListJobs: () =>
    apiRequest<Array<{ id: string; name: string; status: 'ACTIVE' | 'DISABLED'; lastRunAt?: string | null }>>('/api/superadmin/jobs'),
  superadminRunJob: (name: string) => apiRequest<any>(`/api/superadmin/jobs/${name}/run`, { method: 'POST' }),
  superadminEnableJob: (name: string) => apiRequest<any>(`/api/superadmin/jobs/${name}/enable`, { method: 'PATCH' }),
  superadminDisableJob: (name: string) => apiRequest<any>(`/api/superadmin/jobs/${name}/disable`, { method: 'PATCH' }),
};

export const reconciliationApi = {
  upload: async (
    source:
      | 'INFOCOM'
      | 'BANK_STATEMENT'
      | 'MAIB_BANK_STATEMENT'
      | 'VICTORIABANK_STATEMENT'
      | 'MOLDINDCONBANK_STATEMENT'
      | 'OPLATA'
      | 'PAYNET'
      | 'MAIB'
      | 'OTHER_BANK_STATEMENT'
      | 'OTHER',
    file: File,
  ) => {
    const apiUrl = requireApiUrl();
    const formData = new FormData();
    formData.append('source', source);
    formData.append('file', file);
    const response = await fetch(`${apiUrl}/api/admin/reconciliation/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...getOrgScopeHeader('/api/admin/reconciliation/upload') },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    const json = await response.json();
    return { data: json.data ?? json };
  },
  listBatches: () => apiRequest<any[]>('/api/admin/reconciliation/batches'),
  getBatch: (id: string) => apiRequest<any>(`/api/admin/reconciliation/batches/${id}`),
  getBatchHeaders: (id: string) => apiRequest<any>(`/api/admin/reconciliation/batches/${id}/headers`),
  applyBatchMapping: (
    id: string,
    data: { mappingJson: Record<string, string>; saveAsTemplate?: boolean; templateName?: string; isDefault?: boolean },
  ) => apiRequest<any>(`/api/admin/reconciliation/batches/${id}/apply-mapping`, { method: 'POST', body: data }),
  runBatch: (id: string) => apiRequest<any>(`/api/admin/reconciliation/batches/${id}/run`, { method: 'POST' }),
  listMatches: (id: string, params?: { status?: string }) => apiRequest<any[]>(`/api/admin/reconciliation/batches/${id}/matches`, { params }),
  confirmMatch: (id: string) => apiRequest<any>(`/api/admin/reconciliation/matches/${id}/confirm`, { method: 'PATCH' }),
  rejectMatch: (id: string) => apiRequest<any>(`/api/admin/reconciliation/matches/${id}/reject`, { method: 'PATCH' }),
  ignoreImported: (id: string) => apiRequest<any>(`/api/admin/reconciliation/imported-payments/${id}/ignore`, { method: 'PATCH' }),
  listMappingTemplates: (params?: { source?: string }) => apiRequest<any[]>('/api/admin/reconciliation/mapping-templates', { params }),
  createMappingTemplate: (data: any) => apiRequest<any>('/api/admin/reconciliation/mapping-templates', { method: 'POST', body: data }),
  updateMappingTemplate: (id: string, data: any) =>
    apiRequest<any>(`/api/admin/reconciliation/mapping-templates/${id}`, { method: 'PATCH', body: data }),
  deleteMappingTemplate: (id: string) => apiRequest<any>(`/api/admin/reconciliation/mapping-templates/${id}`, { method: 'DELETE' }),
};

export const remindersApi = {
  adminListRules: () => apiRequest<any[]>('/api/admin/reminder-rules'),
  adminCreateRule: (data: {
    name: string;
    isActive?: boolean;
    triggerType: 'BEFORE_DUE_DATE' | 'AFTER_DUE_DATE' | 'DEBT_OVER_AMOUNT' | 'MONTHLY_UNPAID';
    daysOffset?: number;
    debtThreshold?: number;
    channelsJson?: string[];
    messageTemplate: string;
  }) => apiRequest<any>('/api/admin/reminder-rules', { method: 'POST', body: data }),
  adminUpdateRule: (id: string, data: Partial<any>) => apiRequest<any>(`/api/admin/reminder-rules/${id}`, { method: 'PATCH', body: data }),
  adminDeleteRule: (id: string) => apiRequest<any>(`/api/admin/reminder-rules/${id}`, { method: 'DELETE' }),
  adminListLogs: () => apiRequest<any[]>('/api/admin/reminder-logs'),
  adminUpdateApartmentSettings: (
    apartmentId: string,
    data: { remindersPaused: boolean; pauseReason?: string; pausedUntil?: string },
  ) => apiRequest<any>(`/api/admin/apartments/${apartmentId}/reminder-settings`, { method: 'PATCH', body: data }),
  superadminOverview: () => apiRequest<any>('/api/superadmin/reminder-overview'),
};

export const onboardingApi = {
  adminGet: () => apiRequest<any>('/api/admin/onboarding'),
  adminUpdateStep: (data: {
    onboardingStep?: string;
    onboardingStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    buildingsCreated?: boolean;
    apartmentsImported?: boolean;
    residentsImported?: boolean;
    tariffsConfigured?: boolean;
    paymentProviderConfigured?: boolean;
    firstInvoicesGenerated?: boolean;
  }) => apiRequest<any>('/api/admin/onboarding/step', { method: 'PATCH', body: data }),
  adminComplete: () => apiRequest<any>('/api/admin/onboarding/complete', { method: 'POST' }),
  superadminOverview: () => apiRequest<any[]>('/api/superadmin/onboarding-overview'),
};

export const superadminApi = {
  overview: () =>
    apiRequest<any>('/superadmin/overview'),
  listPublicOrganizations: () =>
    apiRequest<any[]>('/organizations'),
  getPublicOrganization: (id: string) =>
    apiRequest<any>(`/organizations/${id}`),
  createPublicOrganization: (data: {
    associationCode: string;
    legalName: string;
    shortName: string;
    name?: string;
    address: string;
    city: string;
    country: string;
    currency?: 'MDL' | 'EUR' | 'USD';
    status?: 'ACTIVE' | 'TRIAL' | 'INACTIVE';
  }) =>
    apiRequest<any>('/organizations', {
      method: 'POST',
      body: data,
    }),
  updatePublicOrganization: (
    id: string,
    data: Partial<{
      associationCode: string;
      legalName: string;
      shortName: string;
      name: string;
      address: string;
      city: string;
      country: string;
      currency: 'MDL' | 'EUR' | 'USD';
      status: 'ACTIVE' | 'TRIAL' | 'INACTIVE';
    }>,
  ) =>
    apiRequest<any>(`/organizations/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  updatePublicOrganizationStatus: (id: string, status: 'ACTIVE' | 'TRIAL' | 'INACTIVE') =>
    apiRequest<any>(`/organizations/${id}/status`, {
      method: 'PATCH',
      body: { status },
    }),
  getOrganizationUsage: (id: string) =>
    apiRequest<any>(`/organizations/${id}/usage`),
  listPlans: () =>
    apiRequest<any[]>('/plans'),
  createPlan: (data: {
    name: string;
    code: 'FREE' | 'TRIAL' | 'STARTER' | 'PRO';
    priceMonthly?: number;
    currency?: 'MDL' | 'EUR' | 'USD';
    apartmentLimit?: number;
    features?: string[];
    status?: 'ACTIVE' | 'INACTIVE';
  }) =>
    apiRequest<any>('/plans', {
      method: 'POST',
      body: data,
    }),
  updatePlan: (
    id: string,
    data: Partial<{
      name: string;
      priceMonthly: number;
      currency: 'MDL' | 'EUR' | 'USD';
      apartmentLimit: number;
      features: string[];
      status: 'ACTIVE' | 'INACTIVE';
    }>,
  ) =>
    apiRequest<any>(`/plans/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  getOrganizationSubscription: (id: string) =>
    apiRequest<any>(`/organizations/${id}/subscription`),
  upsertOrganizationSubscription: (
    id: string,
    data: Partial<{
      planId: string;
      planCode: 'FREE' | 'TRIAL' | 'STARTER' | 'PRO';
      status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
      trialEndsAt: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      price: number;
      customPrice: number;
      apartmentLimit: number;
    }>,
  ) =>
    apiRequest<any>(`/organizations/${id}/subscription`, {
      method: 'POST',
      body: data,
    }),
  listPublicAdmins: () =>
    apiRequest<any[]>('/admins'),
  listPublicOrganizationAdmins: (organizationId: string) =>
    apiRequest<any[]>(`/organizations/${organizationId}/admins`),
  createPublicOrganizationAdmin: (
    organizationId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      password: string;
    },
  ) =>
    apiRequest<any>(`/organizations/${organizationId}/admins`, {
      method: 'POST',
      body: data,
    }),
  updatePublicAdmin: (
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      organizationId: string;
      isActive: boolean;
    }>,
  ) =>
    apiRequest<any>(`/admins/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  listOrgs: () =>
    apiRequest<
      Array<{
        id: string;
        name: string;
        isActive: boolean;
        betaAccessEnabled: boolean;
        isDemo: boolean;
        createdAt: string;
        adminEmail: string | null;
        subscriptionStatus: string | null;
        activeApartments: number;
        monthlyCostMdl: number;
      }>
    >('/api/superadmin/orgs'),
  createOrg: (data: { name: string }) =>
    apiRequest<{ id: string; name: string; isActive: boolean; createdAt: string }>('/api/superadmin/orgs', {
      method: 'POST',
      body: data,
    }),
  updateOrg: (id: string, data: { name?: string; isActive?: boolean; betaAccessEnabled?: boolean; isDemo?: boolean }) =>
    apiRequest<{ id: string; name: string; isActive: boolean; createdAt: string }>(`/api/superadmin/orgs/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  listUsers: (orgId: string) =>
    apiRequest<
      Array<{ id: string; email: string; role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'TENANT'; isActive: boolean; organizationId: string; createdAt: string }>
    >('/api/superadmin/users', { params: { orgId } }),
  createUser: (data: { orgId: string; email: string; role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'TENANT'; password?: string }) =>
    apiRequest<{
      user: { id: string; email: string; role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'TENANT'; organizationId: string; createdAt: string };
      temporaryPassword?: string;
    }>('/api/superadmin/users', { method: 'POST', body: data }),
  updateUser: (id: string, data: { role?: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'TENANT'; resetPassword?: boolean }) =>
    apiRequest<{
      user: { id: string; email: string; role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'TENANT'; organizationId: string; updatedAt: string };
      temporaryPassword?: string;
    }>(`/api/superadmin/users/${id}`, { method: 'PATCH', body: data }),
  startSupportSession: (organizationId: string, reason?: string) =>
    apiRequest<any>(`/api/superadmin/organizations/${organizationId}/support-session/start`, {
      method: 'POST',
      body: { reason: reason || null },
    }),
  endSupportSession: (sessionId: string) =>
    apiRequest<any>(`/api/superadmin/support-session/${sessionId}/end`, { method: 'POST' }),
  currentSupportSession: () => apiRequest<any>('/api/superadmin/support-session/current'),
  listEmailTemplates: () => apiRequest<any[]>('/api/superadmin/email-templates'),
  createEmailTemplate: (data: {
    key: string;
    name: string;
    subject: string;
    body: string;
    targetRole: 'ADMIN' | 'RESIDENT' | 'TEAM' | 'ALL';
    isDefault?: boolean;
  }) => apiRequest<any>('/api/superadmin/email-templates', { method: 'POST', body: data }),
  updateEmailTemplate: (
    id: string,
    data: Partial<{
      key: string;
      name: string;
      subject: string;
      body: string;
      targetRole: 'ADMIN' | 'RESIDENT' | 'TEAM' | 'ALL';
      isDefault: boolean;
    }>,
  ) => apiRequest<any>(`/api/superadmin/email-templates/${id}`, { method: 'PATCH', body: data }),
  deleteEmailTemplate: (id: string) => apiRequest<any>(`/api/superadmin/email-templates/${id}`, { method: 'DELETE' }),
  listOrganizationNotes: (
    organizationId: string,
    params?: { type?: 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER' },
  ) => apiRequest<any[]>(`/api/superadmin/organizations/${organizationId}/notes`, { params }),
  createOrganizationNote: (
    organizationId: string,
    data: {
      type: 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER';
      title: string;
      content: string;
      followUpAt?: string;
      isImportant?: boolean;
    },
  ) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/notes`, { method: 'POST', body: data }),
  updateClientNote: (
    id: string,
    data: Partial<{
      type: 'CALL' | 'MEETING' | 'SUPPORT' | 'SALES' | 'BILLING' | 'OTHER';
      title: string;
      content: string;
      followUpAt: string;
      isImportant: boolean;
    }>,
  ) => apiRequest<any>(`/api/superadmin/client-notes/${id}`, { method: 'PATCH', body: data }),
  listPendingFollowUps: () => apiRequest<any[]>('/api/superadmin/follow-ups'),
  markClientNoteFollowUpDone: (id: string) =>
    apiRequest<any>(`/api/superadmin/client-notes/${id}/mark-follow-up-done`, { method: 'PATCH' }),
  deleteClientNote: (id: string) => apiRequest<any>(`/api/superadmin/client-notes/${id}`, { method: 'DELETE' }),
  listTasks: (params?: {
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueFilter?: 'OVERDUE' | 'TODAY' | 'UPCOMING';
  }) => apiRequest<any[]>('/api/superadmin/tasks', { params }),
  createTask: (data: {
    title: string;
    description?: string;
    status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    relatedType?: 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';
    relatedId?: string;
    dueDate?: string;
    assignedToUserId?: string;
  }) => apiRequest<any>('/api/superadmin/tasks', { method: 'POST', body: data }),
  updateTask: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      relatedType: 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';
      relatedId: string;
      dueDate: string;
      assignedToUserId: string;
    }>,
  ) => apiRequest<any>(`/api/superadmin/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id: string) => apiRequest<any>(`/api/superadmin/tasks/${id}`, { method: 'DELETE' }),
  demoStatus: () =>
    apiRequest<{
      organizations: Array<{ id: string; name: string; createdAt: string }>;
      totals: Record<string, number>;
    }>('/api/superadmin/demo/status'),
  resetDemoData: (confirmText: string) =>
    apiRequest<any>('/api/superadmin/demo/reset', { method: 'POST', body: { confirmText } }),
  listQAChecklist: () =>
    apiRequest<
      Array<{
        id: string;
        key: string;
        section: string;
        title: string;
        status: 'NOT_TESTED' | 'PASSED' | 'FAILED';
        notes: string | null;
        lastTestedAt: string | null;
        testedByUserId: string | null;
        testedByUser?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
      }>
    >('/api/superadmin/qa-checklist'),
  updateQACheck: (id: string, data: Partial<{ status: 'NOT_TESTED' | 'PASSED' | 'FAILED'; notes: string }>) =>
    apiRequest<any>(`/api/superadmin/qa-checklist/${id}`, { method: 'PATCH', body: data }),
  betaReadiness: () =>
    apiRequest<{
      checks: Array<{
        id: string;
        key: string;
        title: string;
        status: 'NOT_CHECKED' | 'PASSED' | 'FAILED';
        notes: string | null;
        isCritical: boolean;
        lastCheckedAt: string | null;
        checkedByUser?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
      }>;
      launchStatus: 'NOT_READY' | 'READY_FOR_BETA' | 'LIVE';
      maintenanceMode: boolean;
      allCriticalPassed: boolean;
      progress: number;
      organizations: { demo: number; real: number };
      betaWarning: string;
    }>('/api/superadmin/beta-readiness'),
  updateBetaReadinessCheck: (id: string, data: Partial<{ status: 'NOT_CHECKED' | 'PASSED' | 'FAILED'; notes: string }>) =>
    apiRequest<any>(`/api/superadmin/beta-readiness/${id}`, { method: 'PATCH', body: data }),
  updateBetaLaunchStatus: (launchStatus: 'NOT_READY' | 'READY_FOR_BETA' | 'LIVE') =>
    apiRequest<any>('/api/superadmin/beta-readiness/launch-status', { method: 'PATCH', body: { launchStatus } }),
  updateMaintenanceMode: (maintenanceMode: boolean) =>
    apiRequest<any>('/api/superadmin/beta-readiness/maintenance-mode', {
      method: 'PATCH',
      body: { maintenanceMode },
    }),
};

export const limitsApi = {
  adminGet: () => apiRequest<any>('/api/admin/limits'),
  superadminGetOrganizationLimits: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/organizations/${organizationId}/limits`),
  superadminUpdateOrganizationLimits: (organizationId: string, data: Partial<{
    maxApartments: number | null;
    maxBuildings: number | null;
    maxTeamMembers: number | null;
    maxResidents: number | null;
    maxStorageMb: number | null;
    modulesJson: Record<string, boolean>;
  }>) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/limits`, { method: 'PATCH', body: data }),
};

export const filesApi = {
  secureDownloadUrl: (fileAssetId: string) => `${requireApiUrl()}/files/${fileAssetId}/download`,
  adminUpload: async (file: File, data: { entityType: 'DOCUMENT' | 'ISSUE_ATTACHMENT' | 'EXPENSE_ATTACHMENT' | 'LOGO' | 'INVOICE_PDF' | 'RECEIPT_PDF' | 'OTHER'; entityId?: string }) => {
    const apiUrl = requireApiUrl();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', data.entityType);
    if (data.entityId) formData.append('entityId', data.entityId);
    const response = await fetch(`${apiUrl}/api/admin/files/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...getOrgScopeHeader('/api/admin/files/upload') },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    const json = await response.json();
    return { data: json?.data ?? json };
  },
  residentUpload: async (file: File, data: { entityType: 'ISSUE_ATTACHMENT' | 'RECEIPT_PDF' | 'OTHER'; entityId?: string }) => {
    const apiUrl = requireApiUrl();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', data.entityType);
    if (data.entityId) formData.append('entityId', data.entityId);
    const response = await fetch(`${apiUrl}/api/resident/files/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...getOrgScopeHeader('/api/resident/files/upload') },
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    const json = await response.json();
    return { data: json?.data ?? json };
  },
  adminList: () => apiRequest<any[]>('/api/admin/files'),
  adminDelete: (id: string) => apiRequest<any>(`/api/admin/files/${id}`, { method: 'DELETE' }),
  superadminStorage: () => apiRequest<any[]>('/api/superadmin/storage'),
  superadminOrganizationStorage: (organizationId: string) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/storage`),
};

export const helpApi = {
  list: (params?: { category?: string; search?: string }) => apiRequest<any[]>('/api/help/articles', { params }),
  getBySlug: (slug: string) => apiRequest<any>(`/api/help/articles/${slug}`),
  superadminList: () => apiRequest<any[]>('/api/superadmin/help/articles'),
  superadminCreate: (data: {
    title: string;
    slug: string;
    content: string;
    targetRole: 'ALL' | 'SUPER_ADMIN' | 'ADMIN' | 'RESIDENT';
    category: 'GETTING_STARTED' | 'PAYMENTS' | 'INVOICES' | 'RESIDENTS' | 'ISSUES' | 'SETTINGS' | 'OTHER';
    isPublished?: boolean;
  }) => apiRequest<any>('/api/superadmin/help/articles', { method: 'POST', body: data }),
  superadminUpdate: (id: string, data: Partial<any>) =>
    apiRequest<any>(`/api/superadmin/help/articles/${id}`, { method: 'PATCH', body: data }),
  superadminDelete: (id: string) => apiRequest<any>(`/api/superadmin/help/articles/${id}`, { method: 'DELETE' }),
};

export const condoApi = {
  getOwnerDashboard: () =>
    apiRequest<{
      organization: { id: string; name: string; defaultLocale: string; weekStart: string } | null;
      summary: {
        year: number;
        adminName: string;
        totalBudgetMdl: number;
        totalExpensesMdl: number;
        repairFundMdl: number;
        debtTotalMdl: number;
        notes: string | null;
        publishedAt: string | null;
      } | null;
      announcements: Array<{
        id: string;
        title: string;
        body: string;
        visibility: string;
        createdAt: string;
      }>;
      units: Array<{
        id: string;
        buildingName: string;
        buildingAddress: string | null;
        unitNumber: string;
        floor: string | null;
        areaSqm: number | null;
        monthlyFeeMdl: number;
        repairFundMdl: number;
        debtMdl: number;
      }>;
      totals: {
        totalMonthlyFeeMdl: number;
        totalDebtMdl: number;
        totalRepairFundMdl: number;
      };
    }>('/api/condo/owner-dashboard'),
  listAnnualSummaries: () =>
    apiRequest<
      Array<{
        id: string;
        year: number;
        status: string;
        adminName: string;
        totalBudgetMdl: number;
        totalExpensesMdl: number;
        repairFundMdl: number;
        debtTotalMdl: number;
        notes: string | null;
        publishedAt: string | null;
      }>
    >('/api/condo/annual-summaries'),
  createAnnualSummary: (data: {
    year: number;
    adminName: string;
    totalBudgetMdl: number;
    totalExpensesMdl: number;
    repairFundMdl: number;
    debtTotalMdl: number;
    notes?: string;
  }) => apiRequest<any>('/api/condo/annual-summaries', { method: 'POST', body: data }),
  publishAnnualSummary: (id: string) => apiRequest<any>(`/api/condo/annual-summaries/${id}/publish`, { method: 'PATCH' }),
  listAnnouncements: () =>
    apiRequest<Array<{ id: string; title: string; body: string; visibility: string; createdAt: string }>>(
      '/api/condo/announcements',
    ),
  createAnnouncement: (data: { title: string; body: string; visibility?: 'OWNERS' | 'ALL' }) =>
    apiRequest<any>('/api/condo/announcements', { method: 'POST', body: data }),
};

export const associationChatApi = {
  listMessages: (params?: { limit?: number; beforeId?: string }) =>
    apiRequest<{
      items: Array<{
        id: string;
        text: string;
        createdAt: string;
        sender: {
          id: string;
          firstName: string | null;
          lastName: string | null;
          email: string;
          role: string;
        };
      }>;
      hasMore: boolean;
      nextBeforeId: string | null;
    }>('/api/association-chat/messages', { params }),
  sendMessage: (data: { text: string }) =>
    apiRequest<{
      id: string;
      text: string;
      createdAt: string;
      sender: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        role: string;
      };
    }>('/api/association-chat/messages', { method: 'POST', body: data }),
};

export const salesApi = {
  getMyOrganizations: () => apiRequest<any[]>('/sales/my-organizations'),
  getCommission: () => apiRequest<any>('/sales/commission'),
  createOrganization: (data: {
    organizationName: string;
    ownerEmail: string;
    ownerFirstName: string;
    ownerLastName: string;
    ownerPassword: string;
  }) => apiRequest<any>('/sales/organizations', { method: 'POST', body: data }),
};
