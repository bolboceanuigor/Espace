import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';

type AuthUser = { role?: string; organizationId?: string | null };

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  private defaults(organizationId: string) {
    return {
      organizationId,
      showResidentNamesInCommunity: false,
      showApartmentNumbersInCommunity: false,
      allowResidentsToContactEachOther: false,
      showIssueReporterName: false,
      showVoteParticipants: false,
    };
  }

  private assertAdmin(user: AuthUser) {
    if (String(user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  private assertResident(user: AuthUser) {
    const role = String(user.role || '').toUpperCase();
    if (!['RESIDENT', 'TENANT'].includes(role)) {
      throw new ForbiddenException('Resident access required');
    }
    if (!user.organizationId) throw new ForbiddenException('Organization context missing');
    return user.organizationId;
  }

  async getByOrganization(organizationId: string) {
    const row = await this.prisma.privacySettings.findUnique({ where: { organizationId } });
    return row || this.defaults(organizationId);
  }

  async adminGet(user: AuthUser) {
    const organizationId = this.assertAdmin(user);
    return this.getByOrganization(organizationId);
  }

  async adminUpdate(user: AuthUser, dto: UpdatePrivacySettingsDto) {
    const organizationId = this.assertAdmin(user);
    return this.prisma.privacySettings.upsert({
      where: { organizationId },
      create: { ...this.defaults(organizationId), ...dto },
      update: { ...dto },
    });
  }

  async residentGet(user: AuthUser) {
    const organizationId = this.assertResident(user);
    return this.getByOrganization(organizationId);
  }
}

