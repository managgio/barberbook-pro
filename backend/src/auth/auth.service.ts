import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseAdminService } from '../modules/firebase/firebase-admin.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  private extractBearerToken(request: any): string | null {
    const header = request?.headers?.authorization || request?.headers?.Authorization;
    if (typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (!token || scheme.toLowerCase() !== 'bearer') return null;
    return token;
  }

  async resolveUserFromRequest(request: any) {
    const token = this.extractBearerToken(request);
    if (!token) return null;
    const decoded = await this.firebaseAdmin.verifyIdToken(token);
    if (!decoded?.uid) return null;
    return this.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  }

  async requireUser(request: any) {
    const user = await this.resolveUserFromRequest(request);
    if (!user) {
      throw new UnauthorizedException('Se requiere autenticación.');
    }
    return user;
  }

  async requireIdentity(request: any) {
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Se requiere autenticación.');
    }
    const decoded = await this.firebaseAdmin.verifyIdToken(token);
    if (!decoded?.uid) {
      throw new UnauthorizedException('Token de autenticación inválido.');
    }
    return decoded;
  }
}
