import { Injectable } from '@nestjs/common';

export type TeamActivityCategory =
  | 'AUTH'
  | 'TEAM'
  | 'ROLES_PERMISSIONS'
  | 'BILLING'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'TARIFFS'
  | 'METERS'
  | 'METER_READINGS'
  | 'RESIDENTS'
  | 'APARTMENTS'
  | 'ANNOUNCEMENTS'
  | 'REQUESTS'
  | 'IMPORTS_EXPORTS'
  | 'DATA_QUALITY'
  | 'SETTINGS'
  | 'SYSTEM';

export type TeamActivityRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const SENSITIVE_KEY_PATTERN = /(password|token|tokenhash|jwt|secret|resettoken|invitationtoken)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

@Injectable()
export class TeamActivityRiskService {
  mapAuditActionToCategory(action: string, entityType?: string | null): TeamActivityCategory {
    const key = `${action || ''} ${entityType || ''}`.toUpperCase();
    if (key.includes('LOGIN') || key.includes('PASSWORD') || key.includes('SESSION') || key.includes('AUTH')) return 'AUTH';
    if (key.includes('ROLE') || key.includes('PERMISSION')) return 'ROLES_PERMISSIONS';
    if (key.includes('STAFF') || key.includes('TEAM') || key.includes('INVITATION')) return 'TEAM';
    if (key.includes('BILLING') || key.includes('DRAFT') || key.includes('FINALIZED')) return 'BILLING';
    if (key.includes('INVOICE')) return 'INVOICES';
    if (key.includes('PAYMENT')) return 'PAYMENTS';
    if (key.includes('TARIFF')) return 'TARIFFS';
    if (key.includes('METER_READING') || key.includes('READING')) return 'METER_READINGS';
    if (key.includes('METER')) return 'METERS';
    if (key.includes('RESIDENT') || key.includes('PORTAL_ACCESS')) return 'RESIDENTS';
    if (key.includes('APARTMENT')) return 'APARTMENTS';
    if (key.includes('ANNOUNCEMENT')) return 'ANNOUNCEMENTS';
    if (key.includes('REQUEST') || key.includes('ISSUE')) return 'REQUESTS';
    if (key.includes('IMPORT') || key.includes('EXPORT')) return 'IMPORTS_EXPORTS';
    if (key.includes('DATA_QUALITY') || key.includes('DUPLICATE')) return 'DATA_QUALITY';
    if (key.includes('SETTING') || key.includes('BACKUP')) return 'SETTINGS';
    return 'SYSTEM';
  }

  mapAuditActionToRisk(action: string, entityType?: string | null): TeamActivityRiskLevel {
    const key = `${action || ''} ${entityType || ''}`.toUpperCase();
    if (
      key.includes('ROLE_PERMISSIONS_UPDATED') ||
      key.includes('TEAM_MEMBER_ROLE_CHANGED') ||
      key.includes('STAFF_MEMBER_SUSPENDED') ||
      key.includes('STAFF_MEMBER_REVOKED') ||
      key.includes('DRAFT_LOCKED') ||
      key.includes('INVOICES_FINALIZED') ||
      key.includes('PAYMENT_CANCELLED') ||
      key.includes('INVOICE_CANCEL') ||
      key.includes('INVOICE_VOID') ||
      key.includes('PORTAL_ACCESS_REVOKED') ||
      key.includes('BILLING_RUN_CANCELLED')
    ) {
      return 'CRITICAL';
    }
    if (
      key.includes('PAYMENT_RECORDED') ||
      key.includes('TARIFF') ||
      key.includes('METER_READING_APPROVED') ||
      key.includes('METER_READING_REJECTED') ||
      key.includes('IMPORT') ||
      key.includes('DATA_QUALITY_FIX') ||
      key.includes('DUPLICATE_MERGE') ||
      key.includes('STAFF_INVITATION') ||
      key.includes('ROLE_')
    ) {
      return 'HIGH';
    }
    if (
      key.includes('ANNOUNCEMENT') ||
      key.includes('REQUEST') ||
      key.includes('RESIDENT') ||
      key.includes('APARTMENT') ||
      key.includes('METER') ||
      key.includes('BILLING_RUN')
    ) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  isSensitiveAction(action: string, entityType?: string | null) {
    const risk = this.mapAuditActionToRisk(action, entityType);
    return risk === 'HIGH' || risk === 'CRITICAL';
  }

  buildActionUrl(entityType?: string | null, entityId?: string | null, metadata?: unknown) {
    const meta = isRecord(metadata) ? metadata : {};
    if (typeof meta.actionUrl === 'string') return meta.actionUrl;
    if (typeof meta.link === 'string') return meta.link;
    if (!entityType || !entityId) return null;
    const type = entityType.toUpperCase();
    if (type.includes('PAYMENT')) return `/admin/payments/${entityId}`;
    if (type.includes('INVOICE')) return `/admin/invoices/${entityId}`;
    if (type.includes('BILLING_RUN')) return `/admin/billing/runs/${entityId}`;
    if (type.includes('TARIFF')) return `/admin/tariffs`;
    if (type.includes('METER_READING')) return `/admin/meter-readings/${entityId}`;
    if (type.includes('METER')) return `/admin/meters/${entityId}`;
    if (type.includes('RESIDENT')) return `/admin/residents/${entityId}`;
    if (type.includes('APARTMENT')) return `/admin/apartments/${entityId}`;
    if (type.includes('ANNOUNCEMENT')) return `/admin/announcements/${entityId}`;
    if (type.includes('REQUEST') || type.includes('ISSUE')) return `/admin/requests/${entityId}`;
    if (type.includes('ASSOCIATION_ROLE')) return `/admin/settings/roles/${entityId}`;
    if (type.includes('ORGANIZATION_MEMBER')) return `/admin/team/${entityId}`;
    if (type.includes('STAFF_INVITATION')) return `/admin/team/invitations/${entityId}`;
    if (type.includes('DATA_QUALITY')) return `/admin/data-quality`;
    return null;
  }

  sanitizeMetadata(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeMetadata(item));
    if (!isRecord(value)) return value;
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[masked]' : this.sanitizeMetadata(entry);
      return acc;
    }, {});
  }
}
