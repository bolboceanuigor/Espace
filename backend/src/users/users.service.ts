import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

const userSelectFields = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    if (!createUserDto.organizationId) {
      throw new BadRequestException('organizationId is required');
    }
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);
    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role ?? Role.ADMIN,
        authProvider: 'LOCAL',
        emailVerifiedAt: null,
        organization: { connect: { id: createUserDto.organizationId } },
      },
      select: userSelectFields,
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      select: userSelectFields,
    });
  }

  /** Used by JWT strategy only; does not scope by organization. */
  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelectFields,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /** Get user by id only if they belong to the given organization. */
  async findOneInOrg(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: userSelectFields,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  /** Update user; only allowed if user belongs to organization. */
  async updateInOrg(id: string, organizationId: string, updateUserDto: UpdateUserDto) {
    await this.findOneInOrg(id, organizationId);
    const passwordHash =
      updateUserDto.password !== undefined
        ? await bcrypt.hash(updateUserDto.password, 10)
        : undefined;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(updateUserDto.email !== undefined ? { email: updateUserDto.email } : {}),
        ...(updateUserDto.firstName !== undefined ? { firstName: updateUserDto.firstName } : {}),
        ...(updateUserDto.lastName !== undefined ? { lastName: updateUserDto.lastName } : {}),
        ...(updateUserDto.isActive !== undefined ? { isActive: updateUserDto.isActive } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(updateUserDto.role !== undefined && { role: updateUserDto.role as Role }),
      },
      select: userSelectFields,
    });
  }

  /** Remove user; only allowed if user belongs to organization. */
  async removeInOrg(id: string, organizationId: string) {
    await this.findOneInOrg(id, organizationId);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
