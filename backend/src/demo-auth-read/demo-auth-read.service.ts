import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DemoAuthReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listDemoUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { in: [Role.SUPERADMIN, Role.ADMIN, Role.RESIDENT] },
        email: {
          in: ['bolboceanuigor@gmail.com', 'admin.demo@espace.md', 'locatar.demo@espace.md'],
        },
      },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
      select: {
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    return users.map((user) => ({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationName: user.organization?.name ?? null,
    }));
  }
}
