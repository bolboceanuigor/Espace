import { SaasSubscriptionStatus } from '@prisma/client';

export const SAAS_LIMIT_KEYS = [
  'maxApartments',
  'maxResidents',
  'maxStaffMembers',
  'maxMeters',
  'maxInvoicesPerMonth',
  'maxAnnouncementsPerMonth',
  'maxRequestsPerMonth',
  'maxStorageMB',
] as const;

export const SAAS_FEATURE_KEYS = [
  'apartmentsCrm',
  'residentsCrm',
  'internalInvoices',
  'manualPayments',
  'meterReadings',
  'meterBasedTariffs',
  'billingRun',
  'dataQuality',
  'announcements',
  'requests',
  'financialReports',
  'consumptionReports',
  'csvImport',
  'csvExport',
  'staffRoles',
  'auditLog',
  'supportAccess',
  'duplicateDetection',
  'advancedSecurity',
] as const;

export type SaasLimitKey = (typeof SAAS_LIMIT_KEYS)[number];
export type SaasFeatureKey = (typeof SAAS_FEATURE_KEYS)[number];
export type SaasUsageStatus = 'OK' | 'WARNING' | 'NEAR_LIMIT' | 'OVER_LIMIT';

export type SaasUsageCounts = {
  apartmentsCount: number;
  residentsCount: number;
  staffMembersCount: number;
  metersCount: number;
  invoicesThisMonth: number;
  announcementsThisMonth: number;
  requestsThisMonth: number;
  storageUsedMB: number | null;
};

export type SaasLimitStatus = {
  key: string;
  limitKey: SaasLimitKey;
  label: string;
  used: number | null;
  limit: number | null;
  percent: number | null;
  status: SaasUsageStatus;
  message: string;
  actionLabel: string;
};

export const BLOCKING_SUBSCRIPTION_STATUSES: SaasSubscriptionStatus[] = [
  SaasSubscriptionStatus.SUSPENDED,
  SaasSubscriptionStatus.CANCELLED,
  SaasSubscriptionStatus.EXPIRED,
];
