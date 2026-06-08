import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Authenticates the server-to-server call from the private audit service when
 * it resolves an iframe context. The audit service sends the static shared
 * secret as `X-Audit-Key`; we constant-time compare it against
 * AUDIT_SVC_SHARED_KEY. This is NOT a user route — there is no JWT here, only
 * the shared secret, so the endpoint it guards must never return anything a
 * caller without the key could use.
 */
@Injectable()
export class AuditServiceKeyGuard implements CanActivate {
  private readonly logger = new Logger(AuditServiceKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('AUDIT_SVC_SHARED_KEY');
    if (!expected) {
      this.logger.error('AUDIT_SVC_SHARED_KEY not set — refusing audit context resolves');
      throw new UnauthorizedException();
    }
    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-audit-key'];
    if (typeof provided !== 'string' || !this.constantTimeEqual(provided, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    // timingSafeEqual throws on length mismatch — guard, but still spend the
    // comparison on a fixed-length buffer to avoid leaking length via timing.
    if (ab.length !== bb.length) {
      timingSafeEqual(bb, bb);
      return false;
    }
    return timingSafeEqual(ab, bb);
  }
}
