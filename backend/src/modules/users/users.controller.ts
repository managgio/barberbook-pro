import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserBlockDto } from './dto/update-user-block.dto';
import { AdminEndpoint } from '../../auth/admin.decorator';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentLocalId } from '../../tenancy/tenant.context';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async canManageOtherUsers(request: Request) {
    const actor = await this.authService.requireUser(request);
    if (actor.isSuperAdmin || actor.isPlatformAdmin) return true;
    if (actor.role !== 'admin') return false;
    const localId = getCurrentLocalId();
    const staff = await this.prisma.locationStaff.findUnique({
      where: {
        localId_userId: {
          localId,
          userId: actor.id,
        },
      },
      select: { userId: true },
    });
    return Boolean(staff);
  }

  private async assertSelfOrManager(request: Request, userId: string) {
    const actor = await this.authService.requireUser(request);
    if (actor.id === userId) return actor;
    const isManager = await this.canManageOtherUsers(request);
    if (!isManager) {
      throw new ForbiddenException('No tienes permisos para operar sobre este usuario.');
    }
    return actor;
  }

  private sanitizeSelfUpdatePayload(data: UpdateUserDto): UpdateUserDto {
    return {
      name: data.name,
      phone: data.phone,
      avatar: data.avatar,
      notificationEmail: data.notificationEmail,
      notificationWhatsapp: data.notificationWhatsapp,
      notificationSms: data.notificationSms,
      prefersBarberSelection: data.prefersBarberSelection,
    };
  }

  @AdminEndpoint()
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('ids') ids?: string,
    @Query('role') role?: string,
    @Query('q') q?: string,
  ) {
    const normalizedRole = role === 'admin' || role === 'client' ? role : undefined;
    const normalizedQuery = q?.trim() || undefined;
    const parsedIds = ids
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (parsedIds && parsedIds.length > 0) {
      return this.usersService.findByIds(parsedIds);
    }

    const pageNumber = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(10, parseInt(pageSize ?? '50', 10) || 50));
    return this.usersService.findPage({
      page: pageNumber,
      pageSize: limit,
      role: normalizedRole,
      query: normalizedQuery,
    });
  }

  @Get('by-email')
  async findByEmail(@Req() req: Request, @Query('email') email?: string) {
    if (!email) return null;
    const identity = await this.authService.requireIdentity(req);
    const actor = await this.authService.resolveUserFromRequest(req);
    const isManager = actor ? await this.canManageOtherUsers(req) : false;
    const identityEmail = typeof identity.email === 'string' ? identity.email.toLowerCase() : '';
    if (!isManager && identityEmail !== email.toLowerCase()) {
      throw new ForbiddenException('No tienes permisos para consultar ese correo.');
    }
    return this.usersService.findByEmail(email);
  }

  @Get('by-firebase/:firebaseUid')
  async findByFirebase(@Req() req: Request, @Param('firebaseUid') firebaseUid: string) {
    const identity = await this.authService.requireIdentity(req);
    const actor = await this.authService.resolveUserFromRequest(req);
    const isManager = actor ? await this.canManageOtherUsers(req) : false;
    if (!isManager && identity.uid !== firebaseUid) {
      throw new ForbiddenException('No tienes permisos para consultar ese usuario.');
    }
    return this.usersService.findByFirebaseUid(firebaseUid);
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    await this.assertSelfOrManager(req, id);
    return this.usersService.findOne(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() data: CreateUserDto) {
    const identity = await this.authService.requireIdentity(req);
    const actor = await this.authService.resolveUserFromRequest(req);
    const isManager = actor ? await this.canManageOtherUsers(req) : false;
    if (!isManager) {
      if (data.firebaseUid !== identity.uid) {
        throw new ForbiddenException('No puedes crear usuarios para otra sesión.');
      }
      const identityEmail = typeof identity.email === 'string' ? identity.email.toLowerCase() : '';
      if (!identityEmail || data.email.toLowerCase() !== identityEmail) {
        throw new ForbiddenException('No puedes crear usuarios con otro correo.');
      }
      const selfPayload: CreateUserDto = {
        ...data,
        role: 'client',
        adminRoleId: null,
        isSuperAdmin: false,
        isPlatformAdmin: false,
      };
      return this.usersService.create(selfPayload);
    }
    return this.usersService.create(data);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() data: UpdateUserDto) {
    const actor = await this.assertSelfOrManager(req, id);
    const isManager = await this.canManageOtherUsers(req);
    if (!isManager && actor.id === id) {
      return this.usersService.update(id, this.sanitizeSelfUpdatePayload(data));
    }
    return this.usersService.update(id, data);
  }

  @AdminEndpoint()
  @Patch(':id/block')
  updateBlockStatus(@Param('id') id: string, @Body() data: UpdateUserBlockDto) {
    return this.usersService.setBrandBlockStatus(id, data.blocked);
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.assertSelfOrManager(req, id);
    return this.usersService.remove(id);
  }
}
