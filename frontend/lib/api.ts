import { clearAuth, getToken, getUser } from './auth';
import type { ApiEnvelope, ApiErrorPayload } from '@/types/api';
import { getApiBaseUrl } from './runtime-config';

const API_URL = getApiBaseUrl();
export const ACTIVE_ORG_STORAGE_KEY = 'activeOrgId';
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API === 'true';

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
  const normalizedPath = normalizeApiPath(path);
  const user = getUser();
  const role = (user?.role || '').toString().toUpperCase();
  const activeOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  if (!activeOrgId) return {};
  if (role === 'ADMIN' && normalizedPath.startsWith('/api/admin/')) {
    return { 'x-association-id': activeOrgId, 'x-org-id': activeOrgId };
  }
  if (role === 'SUPERADMIN' && normalizedPath.startsWith('/api/superadmin/')) {
    return { 'x-org-id': activeOrgId };
  }
  return {};
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
  if (status === 404) {
    return {
      ...payload,
      code: payload.code || 'NOT_FOUND',
      message: 'Înregistrarea nu a fost găsită.',
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
      message: 'API-ul nu este disponibil temporar.',
    });
  }

  const requestUrl = `${API_URL}${normalizeApiPath(path)}${toQueryString(params)}`;
  if (DEBUG_API && typeof window !== 'undefined') {
    console.debug(`[API] ${method} ${requestUrl}`);
  }

  let response: Response;
  try {
    const token = getToken();
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    response = await fetch(requestUrl, {
      method,
      credentials: 'include',
      cache,
      headers: {
        ...(responseType === 'json' && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        Accept: responseType === 'json' ? 'application/json' : '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getOrgScopeHeader(path),
        ...(headers || {}),
      },
      body: body !== undefined && responseType === 'json' && !isFormData ? JSON.stringify(body) : (body as BodyInit | undefined),
    });
  } catch {
    if (DEBUG_API && typeof window !== 'undefined') {
      console.error(`[API] ${method} ${requestUrl} status=NETWORK_ERROR`);
    }
    throw new ApiClientError(503, {
      code: 'NETWORK_ERROR',
      message: 'API-ul nu este disponibil temporar.',
    });
  }

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    if (DEBUG_API && typeof window !== 'undefined') {
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

  if (DEBUG_API && typeof window !== 'undefined') {
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
    message: 'API-ul nu este disponibil temporar.',
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
  validateResetToken: (token: string) =>
  apiRequest<{ valid: boolean }>('/auth/validate-reset-token', { method: 'POST', body: { token } }),
  resetPasswordWithToken: (token: string, data: { password: string; confirmPassword: string }) =>
  apiRequest<any>('/auth/reset-password', { method: 'POST', body: { token, newPassword: data.password } }),
  accountStatus: () =>
  apiRequest<any>('/auth/me'),
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

export const adminContextApi = {
  get: () => apiRequest<any>('/api/admin/context'),
  switchAssociation: (associationId: string) =>
    apiRequest<any>('/api/admin/context/switch-association', { method: 'POST', body: { associationId } }),
};

export const residentContextApi = {
  get: () => apiRequest<any>('/api/resident/context'),
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

export const adminRbacApi = {
  roles: () => apiRequest<any>('/api/admin/settings/roles'),
  createRole: (data: { name: string; description?: string; permissions?: Record<string, boolean> }) =>
    apiRequest<any>('/api/admin/settings/roles', { method: 'POST', body: data }),
  role: (id: string) => apiRequest<any>(`/api/admin/settings/roles/${id}`),
  updateRole: (id: string, data: { name?: string; description?: string }) =>
    apiRequest<any>(`/api/admin/settings/roles/${id}`, { method: 'PATCH', body: data }),
  deleteRole: (id: string) => apiRequest<any>(`/api/admin/settings/roles/${id}`, { method: 'DELETE' }),
  duplicateRole: (id: string) => apiRequest<any>(`/api/admin/settings/roles/${id}/duplicate`, { method: 'POST' }),
  updateRolePermissions: (id: string, permissions: Record<string, boolean>, confirmCritical = false) =>
    apiRequest<any>(`/api/admin/settings/roles/${id}/permissions`, {
      method: 'PATCH',
      body: { permissions, confirmCritical },
    }),
  resetPreset: (id: string) => apiRequest<any>(`/api/admin/settings/roles/${id}/reset-preset`, { method: 'POST' }),
  permissions: () => apiRequest<any>('/api/admin/settings/permissions'),
  matrix: () => apiRequest<any>('/api/admin/settings/permissions/matrix'),
  updateMatrix: (roleId: string, permissions: Record<string, boolean>, confirmCritical = false) =>
    apiRequest<any>('/api/admin/settings/permissions/matrix', {
      method: 'PATCH',
      body: { roleId, permissions, confirmCritical },
    }),
  myPermissions: () => apiRequest<any>('/api/admin/settings/permissions/my'),
  teamMembers: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/permissions-members', { params }),
  teamStats: () => apiRequest<any>('/api/admin/team/stats'),
  teamMember: (memberId: string) => apiRequest<any>(`/api/admin/team/${memberId}`),
  suspendTeamMember: (memberId: string, reason: string) =>
    apiRequest<any>(`/api/admin/team/${memberId}/suspend`, { method: 'PATCH', body: { reason } }),
  reactivateTeamMember: (memberId: string, note?: string) =>
    apiRequest<any>(`/api/admin/team/${memberId}/reactivate`, { method: 'PATCH', body: { note } }),
  revokeTeamMember: (memberId: string, reason: string) =>
    apiRequest<any>(`/api/admin/team/${memberId}/revoke`, { method: 'PATCH', body: { reason } }),
  teamMemberActivity: (memberId: string, params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>(`/api/admin/team/${memberId}/activity`, { params }),
  teamMemberActivityStats: (memberId: string, params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>(`/api/admin/team/${memberId}/activity/stats`, { params }),
  teamActivity: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/activity', { params }),
  teamActivityStats: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/activity/stats', { params }),
  teamActivityDetail: (id: string) => apiRequest<any>(`/api/admin/team/activity/${id}`),
  teamSensitiveActions: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/sensitive-actions', { params }),
  teamSecurity: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/security', { params }),
  teamSecurityStats: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/security/stats', { params }),
  teamMemberPermissions: (memberId: string) => apiRequest<any>(`/api/admin/team/${memberId}/permissions`),
  updateTeamMemberRole: (memberId: string, roleId: string, confirm = true) =>
    apiRequest<any>(`/api/admin/team/${memberId}/role`, { method: 'PATCH', body: { roleId, confirm } }),
  staffInvitations: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/team/invitations', { params }),
  createStaffInvitation: (data: {
    invitedFullName?: string;
    invitedEmail: string;
    invitedPhone?: string;
    roleId: string;
    deliveryMethod?: 'COPY_LINK' | 'EMAIL_PLACEHOLDER' | 'MANUAL';
    expiresInDays?: number;
    message?: string;
    confirmReplaceActive?: boolean;
    confirmCritical?: boolean;
  }) => apiRequest<any>('/api/admin/team/invitations', { method: 'POST', body: data }),
  staffInvitation: (id: string) => apiRequest<any>(`/api/admin/team/invitations/${id}`),
  regenerateStaffInvitation: (id: string) => apiRequest<any>(`/api/admin/team/invitations/${id}/regenerate`, { method: 'POST' }),
  markStaffInvitationSent: (id: string) =>
    apiRequest<any>(`/api/admin/team/invitations/${id}/mark-sent`, { method: 'PATCH' }),
  cancelStaffInvitation: (id: string, reason?: string) =>
    apiRequest<any>(`/api/admin/team/invitations/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  revokeStaffInvitation: (id: string, reason?: string) =>
    apiRequest<any>(`/api/admin/team/invitations/${id}/revoke`, { method: 'PATCH', body: { reason } }),
  staffInvitationPermissionsPreview: (id: string) =>
    apiRequest<any>(`/api/admin/team/invitations/${id}/permissions-preview`),
};

export const staffInvitationsApi = {
  validate: (token: string) => apiRequest<any>(`/api/staff-invitations/${token}`),
  accept: (
    token: string,
    data: { fullName: string; email: string; phone?: string; password: string; confirmPassword: string },
  ) => apiRequest<any>(`/api/staff-invitations/${token}/accept`, { method: 'POST', body: data }),
  linkExisting: (token: string) => apiRequest<any>(`/api/staff-invitations/${token}/link-existing`, { method: 'POST' }),
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
  adminInvoicesCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/invoices.csv', { params, responseType: 'blob' }),
  adminPaymentsCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/payments.csv', { params, responseType: 'blob' }),
  adminApartmentBalancesCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/apartment-balances.csv', { params, responseType: 'blob' }),
  adminFinancialMonthlyCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/financial-monthly.csv', { params, responseType: 'blob' }),
  adminAgingCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/aging.csv', { params, responseType: 'blob' }),
  adminMeterConsumptionCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/meter-consumption.csv', { params, responseType: 'blob' }),
  adminApartmentsCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/apartments.csv', { params, responseType: 'blob' }),
  adminResidentsCsv: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<Blob>('/api/admin/exports/residents.csv', { params, responseType: 'blob' }),
  adminExportHistory: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/exports/history', { params }),
  adminExportOptions: () => apiRequest<any>('/api/admin/exports/options'),
};

export const activityApi = {
  getAll: (params?: { limit?: number; entityType?: string; userId?: string }) =>
    apiRequest<any[]>('/api/activity', { params }),
  adminList: (params?: { limit?: number }) =>
    apiRequest<any[]>('/api/admin/activity', { params }),
  superadminList: (params?: { limit?: number }) =>
    apiRequest<any[]>('/api/superadmin/activity', { params }),
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
  createAdmin: (
    organizationId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      sendEmail?: boolean;
    },
  ) => apiRequest<any>(`/organizations/${organizationId}/admin-invitations`, { method: 'POST', body: data }),
  createResident: (
    residentId: string,
    data: {
      email: string;
      phone?: string;
      sendEmail?: boolean;
    },
  ) => apiRequest<any>(`/residents/${residentId}/invitations`, { method: 'POST', body: data }),
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
  acceptByToken: (token: string, password: string, confirmPassword?: string) =>
    apiRequest<any>(`/api/auth/invitations/${token}/accept`, { method: 'POST', body: { password, confirmPassword } }),
  accept: (data: { token: string; password: string; confirmPassword?: string }) => apiRequest<any>('/api/invitations/accept', { method: 'POST', body: data }),
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
  bulkCreate: (data: {
    buildingId: string;
    staircaseId: string;
    fromNumber: number;
    toNumber: number;
    floorStart: number;
    apartmentsPerFloor: number;
    defaultAreaM2: number;
    defaultRooms?: number;
    status?: 'ACTIVE' | 'EMPTY' | 'DEBTOR' | 'PROBLEM';
  }) => apiRequest<any>('/apartments/bulk-create', { method: 'POST', body: data }),
  linkResident: (apartmentId: string, data: {
    residentId: string;
    role: 'OWNER' | 'RESIDENT' | 'TENANT' | 'FAMILY_MEMBER' | 'REPRESENTATIVE';
    isPrimary?: boolean;
  }) => apiRequest<any>(`/apartments/${apartmentId}/residents`, { method: 'POST', body: data }),
};

export const adminApartmentsCrmApi = {
  list: (params?: {
    search?: string;
    staircase?: string;
    floor?: string;
    status?: string;
    hasPrimaryContact?: string;
    hasArea?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/apartments', { params }),
  get: (id: string) => apiRequest<any>(`/api/admin/apartments/${id}`),
  create: (data: {
    apartmentNumber: string;
    buildingId?: string;
    staircaseId?: string;
    building?: string;
    entrance?: string;
    floor?: number | string | null;
    areaM2?: number | string | null;
    rooms?: number | string | null;
    cadastralNumber?: string;
    status?: 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
    internalNotes?: string;
  }) => apiRequest<any>('/api/admin/apartments', { method: 'POST', body: data }),
  update: (
    id: string,
    data: {
      apartmentNumber: string;
      buildingId?: string;
      staircaseId?: string;
      building?: string;
      entrance?: string;
      floor?: number | string | null;
      areaM2?: number | string | null;
      rooms?: number | string | null;
      cadastralNumber?: string;
      status?: 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
      internalNotes?: string;
    },
  ) => apiRequest<any>(`/api/admin/apartments/${id}`, { method: 'PATCH', body: data }),
  linkResident: (
    id: string,
    data: {
      residentId?: string;
      fullName: string;
      phone?: string;
      email?: string;
      role: 'OWNER' | 'TENANT' | 'REPRESENTATIVE';
      isPrimaryContact?: boolean;
      preferredContactMethod?: 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';
      status?: 'ACTIVE' | 'INVITED' | 'NOT_INVITED';
    },
  ) => apiRequest<any>(`/api/admin/apartments/${id}/residents`, { method: 'POST', body: data }),
  setPrimaryContact: (id: string, residentId: string) =>
    apiRequest<any>(`/api/admin/apartments/${id}/primary-contact`, { method: 'PATCH', body: { residentId } }),
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

export const adminResidentsCrmApi = {
  list: (params?: {
    search?: string;
    role?: string;
    status?: string;
    hasApartment?: string;
    isPrimaryContact?: string;
    preferredContactMethod?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/residents', { params }),
  get: (id: string) => apiRequest<any>(`/api/admin/residents/${id}`),
  create: (data: {
    fullName: string;
    phone?: string;
    email?: string;
    preferredContactMethod?: 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';
    status?: 'ACTIVE' | 'INVITED' | 'NOT_INVITED' | 'INACTIVE';
    internalNotes?: string;
  }) => apiRequest<any>('/api/admin/residents', { method: 'POST', body: data }),
  update: (
    id: string,
    data: {
      fullName: string;
      phone?: string;
      email?: string;
      preferredContactMethod?: 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';
      status?: 'ACTIVE' | 'INVITED' | 'NOT_INVITED' | 'INACTIVE';
      internalNotes?: string;
    },
  ) => apiRequest<any>(`/api/admin/residents/${id}`, { method: 'PATCH', body: data }),
  linkApartment: (
    id: string,
    data: {
      apartmentId: string;
      role: 'OWNER' | 'TENANT' | 'REPRESENTATIVE' | 'RESIDENT';
      isPrimaryContact?: boolean;
      relationStartDate?: string;
      relationEndDate?: string;
      notes?: string;
    },
  ) => apiRequest<any>(`/api/admin/residents/${id}/apartments`, { method: 'POST', body: data }),
  updateApartmentRelation: (
    id: string,
    apartmentId: string,
    data: {
      role: 'OWNER' | 'TENANT' | 'REPRESENTATIVE' | 'RESIDENT';
      isPrimaryContact?: boolean;
      relationStartDate?: string;
      relationEndDate?: string;
      notes?: string;
    },
  ) => apiRequest<any>(`/api/admin/residents/${id}/apartments/${apartmentId}`, { method: 'PATCH', body: data }),
  unlinkApartment: (id: string, apartmentId: string) =>
    apiRequest<any>(`/api/admin/residents/${id}/apartments/${apartmentId}`, { method: 'DELETE' }),
  updateStatus: (id: string, status: 'ACTIVE' | 'INVITED' | 'NOT_INVITED' | 'INACTIVE') =>
    apiRequest<any>(`/api/admin/residents/${id}/status`, { method: 'PATCH', body: { status } }),
  updateRequests: (id: string) => apiRequest<any>(`/api/admin/residents/${id}/update-requests`),
};

export const residentAccessApi = {
  list: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/resident-access', { params }),
  stats: () => apiRequest<any>('/api/admin/resident-access/stats'),
  getResidentAccess: (residentId: string) => apiRequest<any>(`/api/admin/residents/${residentId}/access`),
  createInvitation: (
    residentId: string,
    data: {
      apartmentId?: string;
      invitedEmail?: string;
      invitedPhone?: string;
      deliveryMethod?: 'COPY_LINK' | 'EMAIL_PLACEHOLDER' | 'SMS_PLACEHOLDER' | 'MANUAL';
      expiresInDays?: number;
      message?: string;
      replaceActiveInvitation?: boolean;
    },
  ) => apiRequest<any>(`/api/admin/residents/${residentId}/invitations`, { method: 'POST', body: data }),
  listInvitations: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/resident-access/invitations', { params }),
  getInvitation: (id: string) => apiRequest<any>(`/api/admin/resident-access/invitations/${id}`),
  regenerateInvitation: (id: string, data?: { expiresInDays?: number }) =>
    apiRequest<any>(`/api/admin/resident-access/invitations/${id}/regenerate`, { method: 'POST', body: data || {} }),
  markSent: (id: string) => apiRequest<any>(`/api/admin/resident-access/invitations/${id}/mark-sent`, { method: 'PATCH' }),
  cancelInvitation: (id: string, reason: string) =>
    apiRequest<any>(`/api/admin/resident-access/invitations/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  linkUser: (residentId: string, data: { userId?: string; userEmail?: string; confirm: boolean }) =>
    apiRequest<any>(`/api/admin/residents/${residentId}/portal-access/link-user`, { method: 'POST', body: data }),
  suspend: (residentId: string, reason: string) =>
    apiRequest<any>(`/api/admin/residents/${residentId}/portal-access/suspend`, { method: 'PATCH', body: { reason } }),
  reactivate: (residentId: string, note?: string) =>
    apiRequest<any>(`/api/admin/residents/${residentId}/portal-access/reactivate`, { method: 'PATCH', body: { note } }),
  revoke: (residentId: string, reason: string) =>
    apiRequest<any>(`/api/admin/residents/${residentId}/portal-access/revoke`, { method: 'PATCH', body: { reason } }),
  publicInvitation: (token: string) => apiRequest<any>(`/api/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (
    token: string,
    data: { fullName: string; email: string; phone?: string; password: string; confirmPassword: string },
  ) => apiRequest<any>(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST', body: data }),
};

export const adminResidentUpdateRequestsApi = {
  list: (params?: {
    status?: string;
    requestType?: string;
    apartmentId?: string;
    staircase?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/resident-update-requests', { params }),
  stats: () => apiRequest<any>('/api/admin/resident-update-requests/stats'),
  get: (id: string) => apiRequest<any>(`/api/admin/resident-update-requests/${id}`),
  approve: (
    id: string,
    data: {
      adminResponse?: string;
      internalNotes?: string;
      applyChangeNow?: boolean;
      apartmentRelationPatch?: {
        apartmentId?: string;
        role?: 'OWNER' | 'TENANT' | 'REPRESENTATIVE' | 'RESIDENT';
        isPrimaryContact?: boolean;
        relationStatus?: string;
      };
    },
  ) => apiRequest<any>(`/api/admin/resident-update-requests/${id}/approve`, { method: 'PATCH', body: data }),
  reject: (id: string, data: { adminResponse: string; internalNotes?: string }) =>
    apiRequest<any>(`/api/admin/resident-update-requests/${id}/reject`, { method: 'PATCH', body: data }),
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
  adminList: (params?: Record<string, string | number | boolean | null | undefined>) => apiRequest<any>('/api/admin/meters', { params }),
  adminGet: (id: string) => apiRequest<any>(`/api/admin/meters/${id}`),
  adminCreate: (data: Record<string, unknown>) => apiRequest<any>('/api/admin/meters', { method: 'POST', body: data }),
  adminUpdate: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/admin/meters/${id}`, { method: 'PATCH', body: data }),
  adminChangeStatus: (id: string, data: { status: string }) =>
    apiRequest<any>(`/api/admin/meters/${id}/status`, { method: 'PATCH', body: data }),
  adminReadings: (params?: Record<string, string | number | boolean | null | undefined>) => apiRequest<any>('/api/admin/meter-readings', { params }),
  adminReadingStats: (params?: Record<string, string | number | boolean | null | undefined>) => apiRequest<any>('/api/admin/meter-readings/stats', { params }),
  adminCreateReading: (data: Record<string, unknown>) => apiRequest<any>('/api/admin/meter-readings', { method: 'POST', body: data }),
  adminGetReading: (id: string) => apiRequest<any>(`/api/admin/meter-readings/${id}`),
  adminApproveReading: (id: string, data?: Record<string, unknown>) =>
    apiRequest<any>(`/api/admin/meter-readings/${id}/approve`, { method: 'PATCH', body: data || {} }),
  adminRejectReading: (id: string, data: { rejectionReason: string; adminComment?: string }) =>
    apiRequest<any>(`/api/admin/meter-readings/${id}/reject`, { method: 'PATCH', body: data }),
  adminNeedsReviewReading: (id: string, data?: Record<string, unknown>) =>
    apiRequest<any>(`/api/admin/meter-readings/${id}/needs-review`, { method: 'PATCH', body: data || {} }),
  adminConsumptionReport: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/consumption', { params }),
  adminConsumptionSummary: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/summary', { params }),
  adminConsumptionByMeterType: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/by-meter-type', { params }),
  adminConsumptionByStaircase: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/by-staircase', { params }),
  adminConsumptionByApartment: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/by-apartment', { params }),
  adminConsumptionMissing: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/missing', { params }),
  adminConsumptionIssues: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/issues', { params }),
  adminConsumptionTrends: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/trends', { params }),
  adminTopConsumption: (params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>('/api/admin/meter-readings/reports/top-consumption', { params }),
  adminApartmentMeters: (apartmentId: string) => apiRequest<any>(`/api/admin/apartments/${apartmentId}/meters`),
  adminApartmentReadings: (apartmentId: string, params?: Record<string, string | number | boolean | null | undefined>) =>
    apiRequest<any>(`/api/admin/apartments/${apartmentId}/meter-readings`, { params }),
  residentList: (params?: Record<string, string | number | boolean | null | undefined>) => apiRequest<any>('/api/resident/meters', { params }),
  residentGet: (id: string) => apiRequest<any>(`/api/resident/meters/${id}`),
  residentReadings: (params?: Record<string, string | number | boolean | null | undefined>) => apiRequest<any>('/api/resident/meter-readings', { params }),
  residentCreateReading: (data: Record<string, unknown>) => apiRequest<any>('/api/resident/meter-readings', { method: 'POST', body: data }),
  residentGetReading: (id: string) => apiRequest<any>(`/api/resident/meter-readings/${id}`),
  residentCancelReading: (id: string) => apiRequest<any>(`/api/resident/meter-readings/${id}/cancel`, { method: 'PATCH', body: {} }),
};

export const adminStructureApi = {
  listBuildings: () => apiRequest<any[]>('/admin/buildings'),
  createBuilding: (data: {
    name: string;
    address: string;
    cadastralNumber?: string;
    totalFloors?: number;
    staircasesCount?: number;
    apartmentsCount?: number;
  }) =>
    apiRequest<any>('/admin/buildings', { method: 'POST', body: data }),
  getBuilding: (id: string) => apiRequest<any>(`/admin/buildings/${id}`),
  updateBuilding: (id: string, data: Partial<{ name: string; address: string; cadastralNumber: string; totalFloors: number; staircasesCount: number; apartmentsCount: number }>) =>
    apiRequest<any>(`/admin/buildings/${id}`, { method: 'PATCH', body: data }),
  deleteBuilding: (id: string) => apiRequest<any>(`/admin/buildings/${id}`, { method: 'DELETE' }),

  listAllStaircases: () => apiRequest<any[]>('/admin/staircases'),
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

export const adminImportsApi = {
  importApartments: (data: FormData) => apiRequest<any>('/api/admin/imports/apartments', { method: 'POST', body: data }),
};

export const communicationsApi = {
  listAdminAnnouncements: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/announcements', { params }),
  adminAnnouncementStats: () => apiRequest<any>('/api/admin/announcements/stats'),
  createAdminAnnouncement: (data: Record<string, unknown>) => apiRequest<any>('/api/admin/announcements', { method: 'POST', body: data }),
  getAdminAnnouncement: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}`),
  updateAdminAnnouncement: (id: string, data: any) =>
    apiRequest<any>(`/api/admin/announcements/${id}`, { method: 'PATCH', body: data }),
  publishAdminAnnouncement: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}/publish`, { method: 'PATCH' }),
  archiveAdminAnnouncement: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}/archive`, { method: 'PATCH' }),
  duplicateAdminAnnouncement: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}/duplicate`, { method: 'POST' }),
  deleteAdminAnnouncement: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),
  adminAnnouncementReadStats: (id: string) => apiRequest<any>(`/api/admin/announcements/${id}/read-stats`),

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

  listResidentAnnouncements: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/resident/announcements', { params }),
  listRecentResidentAnnouncements: () => apiRequest<any>('/api/resident/announcements/recent'),
  residentAnnouncementStats: () => apiRequest<any>('/api/resident/announcements/stats'),
  getResidentAnnouncement: (id: string) => apiRequest<any>(`/api/resident/announcements/${id}`),
  markResidentAnnouncementRead: (id: string) => apiRequest<any>(`/api/resident/announcements/${id}/read`, { method: 'PATCH' }),
  listResidentDocuments: () => apiRequest<any[]>('/api/resident/documents'),
  listResidentNotifications: () => apiRequest<any>('/api/resident/notifications'),
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

export const documentsApi = {
  adminList: (params?: { category?: string; visibility?: string; search?: string }) =>
    apiRequest<any[]>('/api/documents', { params }),
  adminGet: (id: string) => apiRequest<any>(`/api/documents/${id}`),
  adminCreate: (data: {
    title: string;
    description?: string;
    category: 'STATUT' | 'PROCES_VERBAL' | 'HOTARARE' | 'CONTRACT' | 'FINANCIAR' | 'TEHNIC' | 'ANUNT' | 'ALTUL';
    visibility: 'ADMIN_ONLY' | 'RESIDENT_VISIBLE';
    fileUrl: string;
    fileName?: string;
    mimeType?: string;
  }) => apiRequest<any>('/api/documents', { method: 'POST', body: data }),
  adminUpdate: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      category: 'STATUT' | 'PROCES_VERBAL' | 'HOTARARE' | 'CONTRACT' | 'FINANCIAR' | 'TEHNIC' | 'ANUNT' | 'ALTUL';
      visibility: 'ADMIN_ONLY' | 'RESIDENT_VISIBLE';
      fileUrl: string;
      fileName: string;
      mimeType: string;
    }>,
  ) => apiRequest<any>(`/api/documents/${id}`, { method: 'PATCH', body: data }),
  residentList: (params?: { category?: string; search?: string }) =>
    apiRequest<any[]>('/api/resident/documents', { params }),
  residentGet: (id: string) => apiRequest<any>(`/api/resident/documents/${id}`),
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

export const requestsApi = {
  residentList: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/resident/requests', { params }),
  residentStats: () => apiRequest<any>('/api/resident/requests/stats'),
  residentCreate: (data: Record<string, unknown>) =>
    apiRequest<any>('/api/resident/requests', { method: 'POST', body: data }),
  residentGet: (id: string) => apiRequest<any>(`/api/resident/requests/${id}`),
  residentAddComment: (id: string, data: { message: string }) =>
    apiRequest<any>(`/api/resident/requests/${id}/comments`, { method: 'POST', body: data }),
  residentCancel: (id: string) => apiRequest<any>(`/api/resident/requests/${id}/cancel`, { method: 'PATCH' }),
  residentClose: (id: string) => apiRequest<any>(`/api/resident/requests/${id}/close`, { method: 'PATCH' }),
  residentMarkResolved: (id: string) => apiRequest<any>(`/api/resident/requests/${id}/mark-resolved`, { method: 'PATCH' }),

  adminList: (params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>('/api/admin/requests', { params }),
  adminStats: () => apiRequest<any>('/api/admin/requests/stats'),
  adminGet: (id: string) => apiRequest<any>(`/api/admin/requests/${id}`),
  adminUpdateStatus: (id: string, status: string) =>
    apiRequest<any>(`/api/admin/requests/${id}/status`, { method: 'PATCH', body: { status } }),
  adminUpdatePriority: (id: string, priority: string) =>
    apiRequest<any>(`/api/admin/requests/${id}/priority`, { method: 'PATCH', body: { priority } }),
  adminAssign: (id: string, assignedToId?: string | null) =>
    apiRequest<any>(`/api/admin/requests/${id}/assign`, { method: 'PATCH', body: { assignedToId } }),
  adminAddComment: (id: string, data: { message: string }) =>
    apiRequest<any>(`/api/admin/requests/${id}/comments`, { method: 'POST', body: data }),
  adminAddInternalNote: (id: string, data: { message: string }) =>
    apiRequest<any>(`/api/admin/requests/${id}/internal-notes`, { method: 'POST', body: data }),
  adminResolve: (id: string) => apiRequest<any>(`/api/admin/requests/${id}/resolve`, { method: 'PATCH' }),
  adminClose: (id: string) => apiRequest<any>(`/api/admin/requests/${id}/close`, { method: 'PATCH' }),
  adminReopen: (id: string) => apiRequest<any>(`/api/admin/requests/${id}/reopen`, { method: 'PATCH' }),
  adminResidentRequests: (residentId: string) => apiRequest<any>(`/api/admin/residents/${residentId}/requests`),
  adminApartmentRequests: (apartmentId: string) => apiRequest<any>(`/api/admin/apartments/${apartmentId}/requests`),
};

export const announcementsApi = {
  list: () => apiRequest<any[]>('/announcements'),
  get: (id: string) => apiRequest<any>(`/announcements/${id}`),
  create: (data: {
    organizationId?: string;
    title: string;
    content: string;
    category?: 'GENERAL' | 'REPAIR' | 'URGENT' | 'ADMINISTRATION';
    status?: 'ACTIVE' | 'ARCHIVED';
  }) => apiRequest<any>('/announcements', { method: 'POST', body: data }),
};

export const messagesMvpApi = {
  residentList: () => apiRequest<any[]>('/resident/messages'),
  residentSend: (data: { content: string; subject?: string }) =>
    apiRequest<any>('/resident/messages', { method: 'POST', body: data }),
  adminList: () => apiRequest<any[]>('/admin/messages'),
  adminSend: (data: { threadId: string; content: string }) =>
    apiRequest<any>('/admin/messages', { method: 'POST', body: data }),
};

export const residentDemoApi = {
  home: () => apiRequest<any>('/resident/home'),
  dashboard: (params?: { apartmentId?: string; includeRecent?: boolean }) => apiRequest<any>('/resident/dashboard', { params }),
  apartments: () => apiRequest<any>('/resident/apartments'),
  apartment: (id: string) => apiRequest<any>(`/resident/apartments/${id}`),
  apartmentFinancialSummary: (id: string) => apiRequest<any>(`/resident/apartments/${id}/financial-summary`),
  apartmentInvoices: (id: string, params?: { page?: number; limit?: number }) =>
    apiRequest<any>(`/resident/apartments/${id}/invoices`, { params }),
  apartmentPayments: (id: string, params?: { page?: number; limit?: number }) =>
    apiRequest<any>(`/resident/apartments/${id}/payments`, { params }),
  profile: () => apiRequest<any>('/resident/profile'),
  updatePreferences: (data: {
    preferredContactMethod?: string;
    receiveInvoiceNotifications?: boolean;
    receivePaymentNotifications?: boolean;
    receiveAnnouncementNotifications?: boolean;
    receiveMaintenanceNotifications?: boolean;
    language?: string;
  }) => apiRequest<any>('/resident/profile/preferences', { method: 'PATCH', body: data }),
  updateRequests: () => apiRequest<any>('/resident/profile/update-requests'),
  updateRequest: (id: string) => apiRequest<any>(`/resident/profile/update-requests/${id}`),
  createUpdateRequest: (data: Record<string, unknown>) =>
    apiRequest<any>('/resident/profile/update-requests', { method: 'POST', body: data }),
  cancelUpdateRequest: (id: string) =>
    apiRequest<any>(`/resident/profile/update-requests/${id}/cancel`, { method: 'PATCH' }),
  context: () => apiRequest<any>('/resident/me'),
  financeSummary: () => apiRequest<any>('/resident/finance-summary'),
  invoices: (params?: {
    apartmentId?: string;
    billingMonth?: string;
    status?: string;
    unpaidOnly?: boolean;
    overdueOnly?: boolean;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/resident/invoices', { params }),
  invoiceStats: (params?: { apartmentId?: string; billingMonth?: string }) => apiRequest<any>('/resident/invoices/stats', { params }),
  invoice: (id: string) => apiRequest<any>(`/resident/invoices/${id}`),
  invoicePayments: (id: string) => apiRequest<any>(`/resident/invoices/${id}/payments`),
  payments: (params?: {
    apartmentId?: string;
    billingMonth?: string;
    invoiceId?: string;
    method?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    confirmedOnly?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }) => apiRequest<any>('/resident/payments', { params }),
  paymentStats: (params?: { apartmentId?: string; billingMonth?: string }) => apiRequest<any>('/resident/payments/stats', { params }),
  payment: (id: string) => apiRequest<any>(`/resident/payments/${id}`),
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
  adminOverview: () => apiRequest<any>('/api/admin/reports'),
  adminFinancialOverview: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/overview', { params }),
  adminFinancialStatusBreakdown: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/status-breakdown', { params }),
  adminFinancialMonthlyTrend: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/monthly-trend', { params }),
  adminFinancialApartments: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/apartments', { params }),
  adminFinancialAging: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/aging', { params }),
  adminFinancialRecentInvoices: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/recent-invoices', { params }),
  adminFinancialRecentPayments: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/reports/financial/recent-payments', { params }),
  adminMonthly: (params?: { month?: number; year?: number }) => apiRequest<any>('/api/admin/reports/monthly', { params }),
  adminDebts: (params?: { buildingId?: string; staircaseId?: string; floor?: number; minDebt?: number; onlyOverdue?: boolean; search?: string }) =>
    apiRequest<any>('/api/admin/reports/debts', { params }),
  adminPayments: (params?: { from?: string; to?: string; method?: string; apartmentId?: string; staircaseId?: string }) =>
    apiRequest<any>('/api/admin/reports/payments', { params }),
  adminApartments: (params?: { buildingId?: string; staircaseId?: string; floor?: number; search?: string }) =>
    apiRequest<any>('/api/admin/reports/apartments', { params }),
  adminResidents: (params?: { search?: string }) => apiRequest<any>('/api/admin/reports/residents', { params }),
  adminCharges: (params?: { month?: number; year?: number }) => apiRequest<any[]>('/api/admin/reports/charges', { params }),
  residentStatement: (params?: { apartmentId?: string }) => apiRequest<any>('/api/resident/reports/statement', { params }),
  superadminPlatform: () => apiRequest<any>('/api/superadmin/reports/platform'),

  adminMonthlyCsv: (params?: { month?: number; year?: number }) =>
    apiRequest<Blob>('/api/admin/reports/monthly.csv', { params, responseType: 'blob' }),
  adminDebtsCsv: (params?: any) => apiRequest<Blob>('/api/admin/reports/debts.csv', { params, responseType: 'blob' }),
  adminPaymentsCsv: (params?: { from?: string; to?: string; method?: string; apartmentId?: string; staircaseId?: string }) =>
    apiRequest<Blob>('/api/admin/reports/payments.csv', { params, responseType: 'blob' }),
  adminApartmentsCsv: (params?: { buildingId?: string; staircaseId?: string; floor?: number; search?: string }) =>
    apiRequest<Blob>('/api/admin/reports/apartments.csv', { params, responseType: 'blob' }),
  adminResidentsCsv: (params?: { search?: string }) =>
    apiRequest<Blob>('/api/admin/reports/residents.csv', { params, responseType: 'blob' }),
  residentStatementPdf: (params?: { apartmentId?: string }) =>
    apiRequest<Blob>('/api/resident/reports/statement/export/pdf', { params, responseType: 'blob' }),
  superadminPlatformXlsx: () => apiRequest<Blob>('/api/superadmin/reports/platform/export/xlsx', { responseType: 'blob' }),
};

export const importsApi = {
  list: (params?: Record<string, string | number | boolean | undefined | null>) => apiRequest<any>('/api/admin/imports', { params }),
  get: (id: string) => apiRequest<any>(`/api/admin/imports/${id}`),
  rows: (id: string, params?: Record<string, string | number | boolean | undefined | null>) =>
    apiRequest<any>(`/api/admin/imports/${id}/rows`, { params }),
  preview: (id: string) => apiRequest<any>(`/api/admin/imports/${id}/preview`),
  confirm: (id: string) => apiRequest<any>(`/api/admin/imports/${id}/confirm`, { method: 'POST', body: { confirm: true } }),
  cancel: (id: string) => apiRequest<any>(`/api/admin/imports/${id}/cancel`, { method: 'PATCH' }),
  confirmApartments: (id: string) =>
    apiRequest<any>(`/api/admin/imports/apartments/${id}/confirm`, { method: 'POST', body: { confirm: true } }),
  confirmResidents: (id: string) =>
    apiRequest<any>(`/api/admin/imports/residents/${id}/confirm`, { method: 'POST', body: { confirm: true } }),
  confirmMeters: (id: string) =>
    apiRequest<any>(`/api/admin/imports/meters/${id}/confirm`, { method: 'POST', body: { confirm: true } }),
  confirmMeterReadings: (id: string) =>
    apiRequest<any>(`/api/admin/imports/meter-readings/${id}/confirm`, { method: 'POST', body: { confirm: true } }),
  apartmentsTemplateCsv: () => apiRequest<Blob>('/api/admin/imports/templates/apartments.csv', { responseType: 'blob' }),
  residentsTemplateCsv: () => apiRequest<Blob>('/api/admin/imports/templates/residents.csv', { responseType: 'blob' }),
  metersTemplateCsv: () => apiRequest<Blob>('/api/admin/imports/templates/meters.csv', { responseType: 'blob' }),
  meterReadingsTemplateCsv: () => apiRequest<Blob>('/api/admin/imports/templates/meter-readings.csv', { responseType: 'blob' }),
  downloadTemplate: (type: 'BUILDINGS' | 'STAIRCASES' | 'APARTMENTS' | 'RESIDENTS' | 'METERS' | 'METER_READINGS' | 'INITIAL_BALANCES') =>
    apiRequest<Blob>(`/api/admin/imports/templates/${type}`, { responseType: 'blob' }),
  previewApartments: (data: FormData) =>
    apiRequest<any>('/api/admin/imports/apartments/preview', { method: 'POST', body: data }),
  previewResidents: (data: FormData) =>
    apiRequest<any>('/api/admin/imports/residents/preview', { method: 'POST', body: data }),
  previewMeters: (data: FormData) =>
    apiRequest<any>('/api/admin/imports/meters/preview', { method: 'POST', body: data }),
  previewMeterReadings: (data: FormData) =>
    apiRequest<any>('/api/admin/imports/meter-readings/preview', { method: 'POST', body: data }),
  upload: async (type: 'BUILDINGS' | 'STAIRCASES' | 'APARTMENTS' | 'RESIDENTS' | 'METERS' | 'METER_READINGS' | 'INITIAL_BALANCES', file: File) => {
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
  adminList: (params?: {
    billingMonth?: string;
    status?: string;
    search?: string;
    apartmentNumber?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    month?: number;
    year?: number;
    buildingId?: string;
    staircaseId?: string;
  }) =>
    apiRequest<any>('/api/admin/invoices', { params }),
  adminGetOne: (id: string) => apiRequest<any>(`/api/admin/invoices/${id}`),
  adminUpdateStatus: (id: string, data: { status: 'CANCELLED' | 'VOID' }) =>
    apiRequest<any>(`/api/admin/invoices/${id}/status`, { method: 'PATCH', body: data }),
  finalizeSummary: (draftId: string) => apiRequest<any>(`/api/admin/invoices/finalize/${draftId}`),
  finalizeDraft: (draftId: string) => apiRequest<any>(`/api/admin/invoices/finalize/${draftId}`, { method: 'POST' }),
  issue: (id: string) => apiRequest<any>(`/api/admin/invoices/${id}/issue`, { method: 'POST' }),
  regenerate: (id: string) => apiRequest<any>(`/api/admin/invoices/${id}/regenerate`, { method: 'POST' }),
  adminPdf: (id: string) => apiRequest<Blob>(`/api/admin/invoices/${id}/pdf`, { responseType: 'blob' }),
  sendReminders: (data: { month: number; year: number; status?: string; message?: string }) =>
    apiRequest<any>('/api/admin/invoices/send-reminders', { method: 'POST', body: data }),
  adminReminderHistory: () => apiRequest<any[]>('/api/admin/reminders'),
  adminReceipts: () => apiRequest<any[]>('/api/admin/receipts'),
  adminReceiptPdf: (id: string) => apiRequest<Blob>(`/api/admin/receipts/${id}/pdf`, { responseType: 'blob' }),
  draftGet: (params: { billingMonth: string }) => apiRequest<any>('/api/admin/invoices/draft', { params }),
  draftCalculate: (data: { billingMonth: string; dueDate?: string | null; description?: string; includeMeterCharges?: boolean }) =>
    apiRequest<any>('/api/admin/invoices/draft/calculate', { method: 'POST', body: data }),
  draftSave: (data: { billingMonth: string; dueDate?: string | null; description?: string; includeMeterCharges?: boolean }) =>
    apiRequest<any>('/api/admin/invoices/draft/save', { method: 'POST', body: data }),
  draftGetOne: (id: string) => apiRequest<any>(`/api/admin/invoices/draft/${id}`),
  draftReview: (id: string) => apiRequest<any>(`/api/admin/invoices/draft/${id}/review`),
  draftRecalculate: (id: string, data?: { billingMonth?: string; dueDate?: string | null; description?: string; includeMeterCharges?: boolean }) =>
    apiRequest<any>(`/api/admin/invoices/draft/${id}/recalculate`, { method: 'PATCH', body: data || {} }),
  meterChargesPreview: (params?: {
    billingMonth?: string;
    periodMonth?: string;
    meterType?: string;
    tariffId?: string;
    staircase?: string;
    apartmentNumber?: string;
    status?: string;
    warningsOnly?: boolean;
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/invoices/draft/meter-charges-preview', { params }),
  draftUpdateLineStatus: (draftId: string, lineId: string, status: 'READY' | 'EXCLUDED') =>
    apiRequest<any>(`/api/admin/invoices/draft/${draftId}/lines/${lineId}/status`, { method: 'PATCH', body: { status } }),
  draftUpdateApartmentStatus: (draftId: string, apartmentId: string, status: 'READY' | 'EXCLUDED') =>
    apiRequest<any>(`/api/admin/invoices/draft/${draftId}/apartments/${apartmentId}/status`, { method: 'PATCH', body: { status } }),
  draftAddAdjustment: (
    draftId: string,
    apartmentId: string,
    data: { name: string; description?: string; amount: number; type: 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION'; status?: 'READY' | 'EXCLUDED' },
  ) => apiRequest<any>(`/api/admin/invoices/draft/${draftId}/apartments/${apartmentId}/adjustments`, { method: 'POST', body: data }),
  draftUpdateAdjustment: (
    draftId: string,
    lineId: string,
    data: { name?: string; description?: string; amount?: number; type?: 'MANUAL_ADJUSTMENT' | 'DISCOUNT' | 'CORRECTION'; status?: 'READY' | 'EXCLUDED' },
  ) => apiRequest<any>(`/api/admin/invoices/draft/${draftId}/adjustments/${lineId}`, { method: 'PATCH', body: data }),
  draftDeleteAdjustment: (draftId: string, lineId: string) =>
    apiRequest<any>(`/api/admin/invoices/draft/${draftId}/adjustments/${lineId}`, { method: 'DELETE' }),
  draftRecalculateApartment: (draftId: string, apartmentId: string) =>
    apiRequest<any>(`/api/admin/invoices/draft/${draftId}/recalculate-apartment/${apartmentId}`, { method: 'POST' }),
  draftLock: (draftId: string, data: { understood: boolean; confirmWarnings?: boolean }) =>
    apiRequest<any>(`/api/admin/invoices/draft/${draftId}/lock`, { method: 'POST', body: data }),
  draftCancel: (id: string) => apiRequest<any>(`/api/admin/invoices/draft/${id}/cancel`, { method: 'PATCH' }),

  residentList: (params?: {
    apartmentId?: string;
    billingMonth?: string;
    status?: string;
    unpaidOnly?: boolean;
    overdueOnly?: boolean;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/resident/invoices', { params }),
  residentGetOne: (id: string) => apiRequest<any>(`/api/resident/invoices/${id}`),
  residentPdf: (id: string) => apiRequest<Blob>(`/api/resident/invoices/${id}/pdf`, { responseType: 'blob' }),
  residentReceipts: () => apiRequest<any[]>('/api/resident/receipts'),
  residentReceiptPdf: (id: string) => apiRequest<Blob>(`/api/resident/receipts/${id}/pdf`, { responseType: 'blob' }),
};

export const billingApi = {
  overview: (params?: { billingMonth?: string }) => apiRequest<any>('/api/admin/billing', { params }),
  runs: (params?: {
    status?: string;
    billingMonth?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }) => apiRequest<any>('/api/admin/billing/runs', { params }),
  createRun: (data: { billingMonth: string }) => apiRequest<any>('/api/admin/billing/runs', { method: 'POST', body: data }),
  getRun: (id: string) => apiRequest<any>(`/api/admin/billing/runs/${id}`),
  updateRun: (id: string, data: Record<string, unknown>) => apiRequest<any>(`/api/admin/billing/runs/${id}`, { method: 'PATCH', body: data }),
  preflight: (id: string) => apiRequest<any>(`/api/admin/billing/runs/${id}/preflight`, { method: 'POST' }),
  calculateDraft: (id: string, data?: { includeMeterCharges?: boolean; dueDate?: string | null; description?: string }) =>
    apiRequest<any>(`/api/admin/billing/runs/${id}/calculate-draft`, { method: 'POST', body: data || {} }),
  linkDraft: (id: string, draftId: string) => apiRequest<any>(`/api/admin/billing/runs/${id}/link-draft`, { method: 'POST', body: { draftId } }),
  updateStatus: (id: string, status: string) => apiRequest<any>(`/api/admin/billing/runs/${id}/status`, { method: 'PATCH', body: { status } }),
  cancel: (id: string, cancellationReason: string) =>
    apiRequest<any>(`/api/admin/billing/runs/${id}/cancel`, { method: 'PATCH', body: { cancellationReason } }),
  checks: (id: string) => apiRequest<any>(`/api/admin/billing/runs/${id}/checks`),
  activity: (id: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>(`/api/admin/billing/runs/${id}/activity`, { params }),
  recentActivity: (id: string) => apiRequest<any>(`/api/admin/billing/runs/${id}/activity/recent`),
};

export const tariffsApi = {
  list: () => apiRequest<any>('/api/admin/tariffs'),
  stats: () => apiRequest<any>('/api/admin/tariffs/stats'),
  get: (id: string) => apiRequest<any>(`/api/admin/tariffs/${id}`),
  create: (data: {
    name: string;
    internalCode?: string;
    description?: string;
    calculationType?: 'PER_M2' | 'FIXED_PER_APARTMENT' | 'MANUAL';
    type?: 'PER_M2' | 'FIXED_PER_APARTMENT' | 'FIXED' | 'MANUAL';
    pricePerM2?: number | null;
    fixedAmount?: number | null;
    defaultManualAmount?: number | null;
    amount?: number;
    currency?: 'MDL';
    periodicity?: 'MONTHLY' | 'ONE_TIME';
    status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
    appliesTo?: 'ALL_APARTMENTS' | 'ONLY_OCCUPIED' | 'CUSTOM_SELECTION';
    includeInMonthlyEstimate?: boolean;
    visibleToResidents?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    internalNotes?: string;
    code?: string;
  }) => apiRequest<any>('/api/admin/tariffs', { method: 'POST', body: data }),
  update: (
    id: string,
    data: {
      name?: string;
      internalCode?: string;
      description?: string;
      calculationType?: 'PER_M2' | 'FIXED_PER_APARTMENT' | 'MANUAL';
      type?: 'PER_M2' | 'FIXED_PER_APARTMENT' | 'FIXED' | 'MANUAL';
      pricePerM2?: number | null;
      fixedAmount?: number | null;
      defaultManualAmount?: number | null;
      amount?: number;
      currency?: 'MDL';
      periodicity?: 'MONTHLY' | 'ONE_TIME';
      status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
      appliesTo?: 'ALL_APARTMENTS' | 'ONLY_OCCUPIED' | 'CUSTOM_SELECTION';
      includeInMonthlyEstimate?: boolean;
      visibleToResidents?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
      internalNotes?: string;
    },
  ) => apiRequest<any>(`/api/admin/tariffs/${id}`, { method: 'PATCH', body: data }),
  updateStatus: (id: string, status: 'DRAFT' | 'ACTIVE' | 'INACTIVE') =>
    apiRequest<any>(`/api/admin/tariffs/${id}/status`, { method: 'PATCH', body: { status } }),
  deactivate: (id: string) => apiRequest<any>(`/api/admin/tariffs/${id}/status`, { method: 'PATCH', body: { status: 'INACTIVE' } }),
  createDefaults: () => apiRequest<any>('/api/admin/tariffs/defaults', { method: 'POST' }),
  duplicate: (id: string) => apiRequest<any>(`/api/admin/tariffs/${id}/duplicate`, { method: 'POST' }),
  preview: () => apiRequest<any>('/api/admin/tariffs/preview'),
  meterBasedList: () => apiRequest<any>('/api/admin/tariffs/meter-based'),
  meterBasedStats: () => apiRequest<any>('/api/admin/tariffs/meter-based/stats'),
  meterBasedGet: (id: string) => apiRequest<any>(`/api/admin/tariffs/meter-based/${id}`),
  meterBasedCreate: (data: any) => apiRequest<any>('/api/admin/tariffs/meter-based', { method: 'POST', body: data }),
  meterBasedUpdate: (id: string, data: any) => apiRequest<any>(`/api/admin/tariffs/meter-based/${id}`, { method: 'PATCH', body: data }),
  meterBasedUpdateStatus: (id: string, status: 'DRAFT' | 'ACTIVE' | 'INACTIVE') =>
    apiRequest<any>(`/api/admin/tariffs/meter-based/${id}/status`, { method: 'PATCH', body: { status } }),
  meterBasedDuplicate: (id: string) => apiRequest<any>(`/api/admin/tariffs/meter-based/${id}/duplicate`, { method: 'POST' }),
  meterBasedImpact: (id: string, params?: { billingMonth?: string; periodMonth?: string; page?: number; limit?: number }) =>
    apiRequest<any>(`/api/admin/tariffs/meter-based/${id}/impact`, { params }),
};

export const financeApi = {
  overview: () => apiRequest<any>('/api/admin/finance-overview'),
};

export const workbenchApi = {
  admin: () => apiRequest<any>('/api/admin/workbench'),
  residentCrm: () => apiRequest<any>('/api/admin/resident-crm'),
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
    method: 'CASH' | 'BANK' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
    paidAt?: string;
  }) => apiRequest<any>('/payments', { method: 'POST', body: data }),
  adminList: (params?: {
    apartmentId?: string;
    search?: string;
    method?: string;
    status?: string;
    invoiceStatus?: string;
    billingMonth?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/payments', { params }),
  adminStats: (params?: { billingMonth?: string; dateFrom?: string; dateTo?: string }) =>
    apiRequest<any>('/api/admin/payments/stats', { params }),
  adminCreate: (data: {
    invoiceId: string;
    amount: number;
    paymentDate: string;
    method: 'CASH' | 'BANK_TRANSFER' | 'CARD_TERMINAL' | 'INFOCOM' | 'OPLATA' | 'OTHER';
    referenceNumber?: string;
    payerName?: string;
    notes?: string;
  }) => apiRequest<any>('/api/admin/payments', { method: 'POST', body: data }),
  adminGetOne: (id: string) => apiRequest<any>(`/api/admin/payments/${id}`),
  adminCancelManual: (id: string, data: { reason: string }) =>
    apiRequest<any>(`/api/admin/payments/${id}/cancel`, { method: 'PATCH', body: data }),
  adminInvoiceSearch: (params?: { search?: string; unpaidOnly?: boolean }) =>
    apiRequest<any>('/api/admin/payments/invoice-search', { params }),
  adminInvoicePayments: (invoiceId: string) => apiRequest<any>(`/api/admin/invoices/${invoiceId}/payments`),
  adminReconciliation: (params?: {
    billingMonth?: string;
    status?: string;
    unpaidOnly?: boolean;
    partiallyPaidOnly?: boolean;
    overdueOnly?: boolean;
    staircase?: string;
    apartmentNumber?: string;
    search?: string;
    minBalance?: string;
    maxBalance?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => apiRequest<any>('/api/admin/payments/reconciliation', { params }),
  adminReconciliationStats: (params?: { billingMonth?: string; status?: string }) =>
    apiRequest<any>('/api/admin/payments/reconciliation/stats', { params }),
  adminReconciliationDebtors: (params?: { billingMonth?: string; limit?: number }) =>
    apiRequest<any>('/api/admin/payments/reconciliation/debtors', { params }),
  adminReconciliationRecentPayments: (params?: { limit?: number }) =>
    apiRequest<any>('/api/admin/payments/reconciliation/recent-payments', { params }),
  adminReconciliationApartment: (apartmentId: string, params?: { billingMonth?: string }) =>
    apiRequest<any>(`/api/admin/payments/reconciliation/apartments/${apartmentId}`, { params }),
  adminManual: (data: {
    apartmentId: string;
    invoiceId?: string;
    amount: number;
    method: 'CASH' | 'BANK' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
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
      city?: string | null;
      country?: string | null;
    }>('/admin/settings/organization'),
  adminUpdate: (data: Partial<any>) => apiRequest<any>('/admin/settings/organization', { method: 'PATCH', body: data }),
  residentPublicInfo: () =>
    apiRequest<{
      name: string;
      address?: string | null;
      city?: string | null;
      country?: string | null;
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
  adminList: (params?: Record<string, string | number | boolean | undefined | null>) => apiRequest<any>('/api/admin/notifications', { params }),
  adminUnreadCount: () => apiRequest<any>('/api/admin/notifications/unread-count'),
  adminRead: (id: string) => apiRequest<any>(`/api/admin/notifications/${id}/read`, { method: 'PATCH' }),
  adminReadAll: (data?: { type?: string }) => apiRequest<any>('/api/admin/notifications/read-all', { method: 'PATCH', body: data }),
  adminTest: (data: { title: string; message: string; type?: string }) =>
    apiRequest<any>('/api/admin/notifications/test', { method: 'POST', body: data }),

  adminGetIntegrations: () => apiRequest<any>('/api/admin/integrations'),
  adminUpdateEmailIntegration: (data: { provider: 'SMTP' | 'SENDGRID' | 'OTHER'; configJson?: any; isActive: boolean }) =>
    apiRequest<any>('/api/admin/integrations/email', { method: 'PATCH', body: data }),
  adminUpdateTelegramIntegration: (data: { botToken: string; isActive: boolean }) =>
    apiRequest<any>('/api/admin/integrations/telegram', { method: 'PATCH', body: data }),
  adminUpdateSmsIntegration: (data: { provider: 'TWILIO' | 'OTHER'; configJson?: any; isActive: boolean }) =>
    apiRequest<any>('/api/admin/integrations/sms', { method: 'PATCH', body: data }),

  residentList: (params?: Record<string, string | number | boolean | undefined | null>) => apiRequest<any>('/api/resident/notifications', { params }),
  residentUnreadCount: () => apiRequest<any>('/api/resident/notifications/unread-count'),
  residentRead: (id: string) => apiRequest<any>(`/api/resident/notifications/${id}/read`, { method: 'PATCH' }),
  residentReadAll: (data?: { type?: string }) => apiRequest<any>('/api/resident/notifications/read-all', { method: 'PATCH', body: data }),
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
  adminActivityList: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/audit-log', { params }),
  adminActivityStats: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/audit-log/stats', { params }),
  adminActivityGet: (id: string) => apiRequest<any>(`/api/admin/audit-log/${id}`),
  billingRunActivity: (id: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>(`/api/admin/billing/runs/${id}/activity`, { params }),
  billingRunActivityRecent: (id: string) => apiRequest<any>(`/api/admin/billing/runs/${id}/activity/recent`),
  superadminList: (params?: {
    organizationId?: string;
    action?: string;
    entityType?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) => apiRequest<any[]>('/api/superadmin/audit-logs', { params }),
};

export const dataQualityApi = {
  overview: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/data-quality', { params }),
  run: (data?: { billingMonth?: string }) =>
    apiRequest<any>('/api/admin/data-quality/run', { method: 'POST', body: data || {} }),
  stats: () => apiRequest<any>('/api/admin/data-quality/stats'),
  runs: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/data-quality/runs', { params }),
  getRun: (id: string) => apiRequest<any>(`/api/admin/data-quality/runs/${id}`),
  issues: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/data-quality/issues', { params }),
  fixes: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/data-quality/fixes', { params }),
  getIssue: (id: string) => apiRequest<any>(`/api/admin/data-quality/issues/${id}`),
  fixOptions: (id: string) => apiRequest<any>(`/api/admin/data-quality/issues/${id}/fix-options`),
  previewFix: (id: string, data: { fixType: string; payload?: Record<string, unknown> }) =>
    apiRequest<any>(`/api/admin/data-quality/issues/${id}/fix/preview`, { method: 'POST', body: data }),
  applyFix: (id: string, data: { fixType: string; payload?: Record<string, unknown>; confirm: boolean }) =>
    apiRequest<any>(`/api/admin/data-quality/issues/${id}/fix/apply`, { method: 'POST', body: data }),
  previewBulkFix: (data: { fixType: string; issueIds: string[]; payload?: Record<string, unknown> }) =>
    apiRequest<any>('/api/admin/data-quality/fixes/bulk/preview', { method: 'POST', body: data }),
  applyBulkFix: (data: { fixType: string; issueIds: string[]; payload?: Record<string, unknown>; confirm: boolean }) =>
    apiRequest<any>('/api/admin/data-quality/fixes/bulk/apply', { method: 'POST', body: data }),
  resolveIssue: (id: string, note?: string) =>
    apiRequest<any>(`/api/admin/data-quality/issues/${id}/resolve`, { method: 'PATCH', body: { note } }),
  ignoreIssue: (id: string, reason: string) =>
    apiRequest<any>(`/api/admin/data-quality/issues/${id}/ignore`, { method: 'PATCH', body: { reason } }),
  reopenIssue: (id: string) =>
    apiRequest<any>(`/api/admin/data-quality/issues/${id}/reopen`, { method: 'PATCH' }),
};

export const dataQualityDuplicatesApi = {
  overview: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/data-quality/duplicates', { params }),
  groups: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/admin/data-quality/duplicates/groups', { params }),
  scan: (data?: { entityTypes?: string[] }) =>
    apiRequest<any>('/api/admin/data-quality/duplicates/scan', { method: 'POST', body: data || {} }),
  stats: () => apiRequest<any>('/api/admin/data-quality/duplicates/stats'),
  getGroup: (id: string) => apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}`),
  mergePreview: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}/merge/preview`, { method: 'POST', body: data }),
  mergeApply: (id: string, data: { mergePlanId: string; confirm: boolean }) =>
    apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}/merge/apply`, { method: 'POST', body: data }),
  markNotDuplicate: (id: string, reason: string) =>
    apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}/not-duplicate`, { method: 'PATCH', body: { reason } }),
  markReviewed: (id: string, reason?: string) =>
    apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}/reviewed`, { method: 'PATCH', body: { reason } }),
  ignore: (id: string, reason: string) =>
    apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}/ignore`, { method: 'PATCH', body: { reason } }),
  reopen: (id: string) =>
    apiRequest<any>(`/api/admin/data-quality/duplicates/groups/${id}/reopen`, { method: 'PATCH' }),
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
  emailStatus: () =>
    apiRequest<{
      configured: boolean;
      provider: 'resend' | 'smtp' | null;
      from?: string;
    }>('/api/system/email-status'),
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
  overview: () => apiRequest<any>('/api/superadmin/billing/overview'),
  listPlans: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/superadmin/billing/plans', { params }),
  createSaasPlan: (data: Record<string, unknown>) =>
    apiRequest<any>('/api/superadmin/billing/plans', { method: 'POST', body: data }),
  getSaasPlan: (id: string) => apiRequest<any>(`/api/superadmin/billing/plans/${id}`),
  updateSaasPlan: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/billing/plans/${id}`, { method: 'PATCH', body: data }),
  updateSaasPlanStatus: (id: string, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') =>
    apiRequest<any>(`/api/superadmin/billing/plans/${id}/status`, { method: 'PATCH', body: { status } }),
  duplicateSaasPlan: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/plans/${id}/duplicate`, { method: 'POST' }),
  saasPlanAssociations: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/plans/${id}/associations`),
  listSaasSubscriptions: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/superadmin/billing/subscriptions', { params }),
  createSaasSubscription: (data: Record<string, unknown>) =>
    apiRequest<any>('/api/superadmin/billing/subscriptions', { method: 'POST', body: data }),
  getSaasSubscription: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}`),
  changeSaasPlan: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/change-plan`, { method: 'PATCH', body: data }),
  activateSaasSubscription: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/activate`, { method: 'PATCH' }),
  suspendSaasSubscription: (id: string, reason: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/suspend`, { method: 'PATCH', body: { reason } }),
  reactivateSaasSubscription: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/reactivate`, { method: 'PATCH' }),
  cancelSaasSubscription: (id: string, reason: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  addSaasSubscriptionNote: (id: string, note: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/notes`, { method: 'POST', body: { note } }),
  getAssociationSaasSubscription: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/associations/${organizationId}/subscription`),
  assignAssociationSaasPlan: (organizationId: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/associations/${organizationId}/subscription/assign-plan`, { method: 'POST', body: data }),
  getAssociationSaasUsage: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/associations/${organizationId}/subscription/usage`),
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
  getAdminSubscriptionUsage: () => apiRequest<any>('/api/admin/subscription/usage'),
  getAdminSubscriptionLimits: () => apiRequest<any>('/api/admin/subscription/limits'),
  getAdminSubscriptionFeatures: () => apiRequest<any>('/api/admin/subscription/features'),
  getAdminSubscriptionWarnings: () => apiRequest<any>('/api/admin/subscription/warnings'),
  getAdminUpgradeOptions: () => apiRequest<any>('/api/admin/subscription/upgrade-options'),
  createAdminUpgradeRequest: (data: Record<string, unknown>) =>
    apiRequest<any>('/api/admin/subscription/upgrade-requests', { method: 'POST', body: data }),
  listAdminUpgradeRequests: () => apiRequest<any>('/api/admin/subscription/upgrade-requests'),
  getAdminUpgradeRequest: (id: string) => apiRequest<any>(`/api/admin/subscription/upgrade-requests/${id}`),
  cancelAdminUpgradeRequest: (id: string, cancellationReason?: string) =>
    apiRequest<any>(`/api/admin/subscription/upgrade-requests/${id}/cancel`, { method: 'PATCH', body: { cancellationReason } }),
  listSuperadminUpgradeRequests: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/superadmin/billing/upgrade-requests', { params }),
  superadminUpgradeRequestStats: () => apiRequest<any>('/api/superadmin/billing/upgrade-requests/stats'),
  getSuperadminUpgradeRequest: (id: string) => apiRequest<any>(`/api/superadmin/billing/upgrade-requests/${id}`),
  markUpgradeRequestInReview: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/upgrade-requests/${id}/in-review`, { method: 'PATCH' }),
  approveUpgradeRequest: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/billing/upgrade-requests/${id}/approve`, { method: 'PATCH', body: data }),
  rejectUpgradeRequest: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/billing/upgrade-requests/${id}/reject`, { method: 'PATCH', body: data }),
  getAssociationUpgradeRequests: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/associations/${organizationId}/upgrade-requests`),
  superadminUsageOverview: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/superadmin/billing/usage', { params }),
  superadminUsageAssociations: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/superadmin/billing/usage/associations', { params }),
  getSaasSubscriptionUsage: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/subscriptions/${id}/usage`),
  getSuperadminAssociationUsage: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/associations/${organizationId}/usage`),
  listSaasInvoices: (params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<any>('/api/superadmin/billing/saas-invoices', { params }),
  saasInvoiceStats: () => apiRequest<any>('/api/superadmin/billing/saas-invoices/stats'),
  createSaasInvoice: (data: Record<string, unknown>) =>
    apiRequest<any>('/api/superadmin/billing/saas-invoices', { method: 'POST', body: data }),
  createSaasInvoiceFromSubscription: (data: Record<string, unknown>) =>
    apiRequest<any>('/api/superadmin/billing/saas-invoices/from-subscription', { method: 'POST', body: data }),
  getSaasInvoice: (id: string) => apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}`),
  updateSaasInvoice: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}`, { method: 'PATCH', body: data }),
  issueSaasInvoice: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}/issue`, { method: 'PATCH' }),
  markSaasInvoicePaid: (id: string, data: Record<string, unknown>) =>
    apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}/mark-paid`, { method: 'PATCH', body: data }),
  cancelSaasInvoice: (id: string, reason: string) =>
    apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  voidSaasInvoice: (id: string, reason: string) =>
    apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}/void`, { method: 'PATCH', body: { reason } }),
  getSaasInvoiceEvents: (id: string) =>
    apiRequest<any>(`/api/superadmin/billing/saas-invoices/${id}/events`),
  getAssociationSaasInvoices: (organizationId: string) =>
    apiRequest<any>(`/api/superadmin/associations/${organizationId}/saas-invoices`),
  listAdminSaasInvoices: () => apiRequest<any>('/api/admin/subscription/invoices'),
  getAdminSaasInvoice: (id: string) => apiRequest<any>(`/api/admin/subscription/invoices/${id}`),
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

export type AssociationOnboardingStepOne = {
  legalName: string;
  shortName: string;
  associationCode: string;
  internalNumber?: string;
  fiscalCode?: string;
  address: string;
  city: string;
  country: string;
  status?: 'DRAFT' | 'ACTIVE';
};

export type AssociationOnboardingApartment = {
  id?: string;
  apartmentNumber: string;
  building: string;
  entrance: string;
  floor?: number | null;
  areaM2?: number | null;
  rooms?: number | null;
  cadastralNumber?: string;
  status: 'VACANT' | 'OCCUPIED' | 'UNKNOWN';
};

export type AssociationOnboardingResident = {
  residentId?: string;
  apartmentId?: string;
  apartmentNumber: string;
  building: string;
  entrance: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: 'OWNER' | 'TENANT' | 'REPRESENTATIVE';
  isPrimaryContact: boolean;
  preferredContactMethod: 'PHONE' | 'EMAIL' | 'APP' | 'WHATSAPP' | 'TELEGRAM';
  status: 'INVITED' | 'ACTIVE' | 'NOT_INVITED';
};

export const associationOnboardingApi = {
  start: (data: AssociationOnboardingStepOne) =>
    apiRequest<any>('/api/superadmin/associations/onboarding/start', { method: 'POST', body: data }),
  get: (id: string) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}`),
  updateStepOne: (id: string, data: AssociationOnboardingStepOne) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}/step-1`, { method: 'PATCH', body: data }),
  updateStepTwo: (
    id: string,
    data: {
      buildingsCount: number;
      staircasesCount: number;
      floorsCount: number;
      apartmentsCount: number;
      constructionYear?: number | null;
      internalNotes?: string;
    },
  ) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}/step-2`, { method: 'PATCH', body: data }),
  updateApartments: (id: string, apartments: AssociationOnboardingApartment[]) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}/apartments`, {
      method: 'PATCH',
      body: { apartments },
    }),
  updateResidents: (id: string, residents: AssociationOnboardingResident[]) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}/residents`, {
      method: 'PATCH',
      body: { residents },
    }),
  updateTariffs: (
    id: string,
    data: {
      deservireBlocPerM2: number;
      fondReparatiePerM2: number;
      fondInvestitiiPerApartment: number;
      otherFixedServices?: Array<{ name: string; amount: number }>;
    },
  ) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}/tariffs`, { method: 'PATCH', body: data }),
  activate: (id: string) =>
    apiRequest<any>(`/api/superadmin/associations/onboarding/${id}/activate`, { method: 'POST' }),
};

export const superadminApi = {
  workbench: () =>
    apiRequest<any>('/api/superadmin/workbench'),
  overview: () =>
    apiRequest<any>('/superadmin/overview'),
  listPublicOrganizations: () =>
    apiRequest<any[]>('/organizations'),
  getPublicOrganization: (id: string) =>
    apiRequest<any>(`/organizations/${id}`),
  createPublicOrganization: (data: {
    associationCode: string;
    associationNumber?: string;
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
    relatedType?: 'ORGANIZATION' | 'LEAD' | 'DEMO_REQUEST' | 'FEATURE_REQUEST' | 'SUPPORT';
    relatedId?: string;
  }) => apiRequest<any[]>('/api/superadmin/tasks', { params }),
  listOrganizationTasks: (organizationId: string) =>
    apiRequest<any[]>(`/api/superadmin/organizations/${organizationId}/tasks`),
  createOrganizationTask: (
    organizationId: string,
    data: {
      title: string;
      description?: string;
      status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: string;
      assignedToUserId?: string;
    },
  ) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/tasks`, { method: 'POST', body: data }),
  updateOrganizationTask: (
    organizationId: string,
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
      priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate: string;
      assignedToUserId: string;
    }>,
  ) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/tasks/${taskId}`, { method: 'PATCH', body: data }),
  updateOrganizationTaskStatus: (
    organizationId: string,
    taskId: string,
    status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED',
  ) => apiRequest<any>(`/api/superadmin/organizations/${organizationId}/tasks/${taskId}/status`, { method: 'PATCH', body: { status } }),
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
