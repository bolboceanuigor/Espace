-- ES-127 Admin RBAC Permissions Matrix & Module Guards

CREATE TYPE "AssociationRoleType" AS ENUM ('ASSOCIATION_OWNER', 'ASSOCIATION_ADMIN', 'FINANCE_OPERATOR', 'METER_OPERATOR', 'SUPPORT_OPERATOR', 'READ_ONLY', 'CUSTOM');
CREATE TYPE "PermissionModule" AS ENUM ('DASHBOARD', 'APARTMENTS', 'RESIDENTS', 'TARIFFS', 'METERS', 'METER_READINGS', 'BILLING', 'INVOICES', 'PAYMENTS', 'RECONCILIATION', 'REPORTS', 'ANNOUNCEMENTS', 'REQUESTS', 'IMPORTS', 'EXPORTS', 'DATA_QUALITY', 'TEAM', 'SETTINGS', 'AUDIT_LOG', 'NOTIFICATIONS');
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'CANCEL', 'EXPORT', 'IMPORT', 'MANAGE', 'FINALIZE', 'LOCK', 'ASSIGN', 'INVITE');

CREATE TABLE "association_roles" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "AssociationRoleType" NOT NULL DEFAULT 'CUSTOM',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "association_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "association_permissions" (
  "id" TEXT NOT NULL,
  "module" "PermissionModule" NOT NULL,
  "action" "PermissionAction" NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "isCritical" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "association_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "association_role_permissions" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "association_role_permissions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "organization_members" ADD COLUMN "associationRoleId" TEXT;

CREATE INDEX "association_roles_organizationId_type_idx" ON "association_roles"("organizationId", "type");
CREATE INDEX "association_roles_organizationId_isSystem_idx" ON "association_roles"("organizationId", "isSystem");
CREATE UNIQUE INDEX "association_permissions_module_action_key" ON "association_permissions"("module", "action");
CREATE UNIQUE INDEX "association_role_permissions_roleId_permissionId_key" ON "association_role_permissions"("roleId", "permissionId");
CREATE INDEX "organization_members_organizationId_associationRoleId_idx" ON "organization_members"("organizationId", "associationRoleId");

ALTER TABLE "association_roles"
  ADD CONSTRAINT "association_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "association_roles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "association_roles_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "association_role_permissions"
  ADD CONSTRAINT "association_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "association_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "association_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "association_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_members"
  ADD CONSTRAINT "organization_members_associationRoleId_fkey" FOREIGN KEY ("associationRoleId") REFERENCES "association_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
