import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserUseCase } from '../../contexts/identity/application/use-cases/create-user.use-case';
import { FindUserByEmailUseCase } from '../../contexts/identity/application/use-cases/find-user-by-email.use-case';
import { FindUserByFirebaseUidUseCase } from '../../contexts/identity/application/use-cases/find-user-by-firebase-uid.use-case';
import { FindUserByIdUseCase } from '../../contexts/identity/application/use-cases/find-user-by-id.use-case';
import { FindUsersByIdsUseCase } from '../../contexts/identity/application/use-cases/find-users-by-ids.use-case';
import { FindUsersPageUseCase } from '../../contexts/identity/application/use-cases/find-users-page.use-case';
import { RemoveUserUseCase } from '../../contexts/identity/application/use-cases/remove-user.use-case';
import { SetUserBrandBlockStatusUseCase } from '../../contexts/identity/application/use-cases/set-user-brand-block-status.use-case';
import { UpdateUserUseCase } from '../../contexts/identity/application/use-cases/update-user.use-case';
import { IdentityUserAccessRecord, IdentityUserRole } from '../../contexts/identity/domain/entities/user-access.entity';
import {
  IDENTITY_AUTH_USER_PORT,
  IdentityAuthUserPort,
} from '../../contexts/identity/ports/outbound/identity-auth-user.port';
import {
  IDENTITY_USER_READ_PORT,
  UserReadPort,
} from '../../contexts/identity/ports/outbound/user-read.port';
import {
  IDENTITY_USER_WRITE_PORT,
  UserWritePort,
} from '../../contexts/identity/ports/outbound/user-write.port';
import { TENANT_CONTEXT_PORT, TenantContextPort } from '../../contexts/platform/ports/outbound/tenant-context.port';
import { rethrowDomainErrorAsHttp } from '../../shared/interfaces/http/rethrow-domain-error-as-http';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly findUsersByIdsUseCase: FindUsersByIdsUseCase;
  private readonly findUsersPageUseCase: FindUsersPageUseCase;
  private readonly findUserByIdUseCase: FindUserByIdUseCase;
  private readonly findUserByEmailUseCase: FindUserByEmailUseCase;
  private readonly findUserByFirebaseUidUseCase: FindUserByFirebaseUidUseCase;
  private readonly createUserUseCase: CreateUserUseCase;
  private readonly updateUserUseCase: UpdateUserUseCase;
  private readonly setUserBrandBlockStatusUseCase: SetUserBrandBlockStatusUseCase;
  private readonly removeUserUseCase: RemoveUserUseCase;

  constructor(
    @Inject(IDENTITY_USER_READ_PORT)
    private readonly userReadPort: UserReadPort,
    @Inject(IDENTITY_USER_WRITE_PORT)
    private readonly userWritePort: UserWritePort,
    @Inject(IDENTITY_AUTH_USER_PORT)
    private readonly identityAuthUserPort: IdentityAuthUserPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContextPort: TenantContextPort,
  ) {
    this.findUsersByIdsUseCase = new FindUsersByIdsUseCase(this.userReadPort);
    this.findUsersPageUseCase = new FindUsersPageUseCase(this.userReadPort);
    this.findUserByIdUseCase = new FindUserByIdUseCase(this.userReadPort);
    this.findUserByEmailUseCase = new FindUserByEmailUseCase(this.userReadPort);
    this.findUserByFirebaseUidUseCase = new FindUserByFirebaseUidUseCase(this.userReadPort);
    this.createUserUseCase = new CreateUserUseCase(this.userWritePort);
    this.updateUserUseCase = new UpdateUserUseCase(this.userWritePort);
    this.setUserBrandBlockStatusUseCase = new SetUserBrandBlockStatusUseCase(this.userWritePort);
    this.removeUserUseCase = new RemoveUserUseCase(this.userWritePort, this.identityAuthUserPort);
  }

  private mapUserRecord(user: IdentityUserAccessRecord) {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid || undefined,
      name: user.name,
      email: user.email,
      phone: user.phone || undefined,
      role: user.role,
      notificationPrefs: {
        email: user.notificationEmail,
        whatsapp: user.notificationWhatsapp,
        sms: user.notificationSms,
      },
      isBlocked: user.isBlocked,
      prefersBarberSelection: user.prefersBarberSelection,
      avatar: user.avatar || undefined,
      isSuperAdmin: user.isSuperAdmin,
      isPlatformAdmin: user.isPlatformAdmin,
      isLocalAdmin: user.isLocalAdmin,
      adminRoleId: user.localAdminRoleId ?? user.adminRoleId ?? null,
    };
  }

  async findByIds(ids: string[]) {
    const users = await this.findUsersByIdsUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      ids,
    });
    return users.map((user) => this.mapUserRecord(user));
  }

  async findPage(params: { page: number; pageSize: number; role?: IdentityUserRole; query?: string }) {
    const { total, users } = await this.findUsersPageUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      page: params.page,
      pageSize: params.pageSize,
      role: params.role,
      query: params.query,
    });

    return {
      total,
      page: params.page,
      pageSize: params.pageSize,
      hasMore: params.page * params.pageSize < total,
      items: users.map((user) => this.mapUserRecord(user)),
    };
  }

  async findOne(id: string) {
    const user = await this.findUserByIdUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      userId: id,
    });

    if (!user) throw new NotFoundException('User not found');
    return this.mapUserRecord(user);
  }

  async findByEmail(email: string) {
    const user = await this.findUserByEmailUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      email,
    });

    if (user?.isBlocked) {
      throw new ForbiddenException('Usuario bloqueado');
    }

    return user ? this.mapUserRecord(user) : null;
  }

  async findByFirebaseUid(firebaseUid: string) {
    const user = await this.findUserByFirebaseUidUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      firebaseUid,
    });

    if (user?.isBlocked) {
      throw new ForbiddenException('Usuario bloqueado');
    }

    return user ? this.mapUserRecord(user) : null;
  }

  async create(data: CreateUserDto) {
    const created = await this.createUserUseCase.execute({
      context: this.tenantContextPort.getRequestContext(),
      firebaseUid: data.firebaseUid,
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role as IdentityUserRole | undefined,
      avatar: data.avatar,
      adminRoleId: data.adminRoleId,
      isSuperAdmin: data.isSuperAdmin,
      isPlatformAdmin: data.isPlatformAdmin,
      notificationEmail: data.notificationEmail,
      notificationWhatsapp: data.notificationWhatsapp,
      notificationSms: data.notificationSms,
      prefersBarberSelection: data.prefersBarberSelection,
    });
    return this.mapUserRecord(created);
  }

  async update(id: string, data: UpdateUserDto) {
    try {
      const updated = await this.updateUserUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        userId: id,
        firebaseUid: data.firebaseUid,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role as IdentityUserRole | undefined,
        avatar: data.avatar,
        adminRoleId: data.adminRoleId,
        isSuperAdmin: data.isSuperAdmin,
        isPlatformAdmin: data.isPlatformAdmin,
        notificationEmail: data.notificationEmail,
        notificationWhatsapp: data.notificationWhatsapp,
        notificationSms: data.notificationSms,
        prefersBarberSelection: data.prefersBarberSelection,
      });
      return this.mapUserRecord(updated);
    } catch (error) {
      this.rethrowUserNotFound(error);
      throw error;
    }
  }

  async setBrandBlockStatus(userId: string, isBlocked: boolean) {
    try {
      const updated = await this.setUserBrandBlockStatusUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        userId,
        isBlocked,
      });
      return this.mapUserRecord(updated);
    } catch (error) {
      this.rethrowUserNotFound(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.removeUserUseCase.execute({
        context: this.tenantContextPort.getRequestContext(),
        userId: id,
      });
    } catch (error) {
      this.rethrowUserNotFound(error);
      throw error;
    }
  }

  private rethrowUserNotFound(error: unknown): never | void {
    rethrowDomainErrorAsHttp(error, {
      USER_NOT_FOUND: () => new NotFoundException('User not found'),
    });
  }
}
