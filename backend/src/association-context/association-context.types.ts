import type { Request } from 'express';

export type AssociationContextUser = {
  id?: string;
  sub?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  role?: string | null;
  platformRole?: string | null;
  organizationId?: string | null;
};

export type AssociationSummary = {
  id: string;
  shortName: string;
  associationCode: string | null;
  status?: string | null;
  membershipStatus?: string | null;
};

export type AdminAssociationContext = {
  associationId: string;
  membershipId: string | null;
  roleId: string | null;
  roleType: string;
  roleName: string;
  permissions: string[];
  permissionLabels: string[];
  activeAssociation: AssociationSummary;
  availableAssociations: AssociationSummary[];
  isSupportMode?: boolean;
  supportSession?: {
    id: string;
    mode: 'READ_ONLY' | 'SUPPORT_WRITE' | string;
    status: string;
    reason: string;
    internalTicketRef?: string | null;
    startedAt: Date | string;
    expiresAt?: Date | string | null;
  } | null;
};

export type ResidentAssociationContext = {
  residentId: string;
  userId: string;
  portalAccessStatus: string;
  apartmentIds: string[];
  associationIds: string[];
  apartments: Array<{
    id: string;
    apartmentNumber: string;
    staircase?: string | null;
    association: AssociationSummary;
  }>;
  associations: AssociationSummary[];
  activeAssociation: AssociationSummary | null;
};

export type RequestWithTenantContext = Request & {
  user?: AssociationContextUser;
  associationContext?: AdminAssociationContext;
  residentContext?: ResidentAssociationContext;
  supportSessionContext?: NonNullable<AdminAssociationContext['supportSession']> & {
    associationId: string;
    startedById: string;
    isReadOnly: boolean;
  };
};

export function getAssociationContextFromRequest(request: Request): AdminAssociationContext | null {
  return (request as RequestWithTenantContext).associationContext || null;
}

export function getResidentContextFromRequest(request: Request): ResidentAssociationContext | null {
  return (request as RequestWithTenantContext).residentContext || null;
}
