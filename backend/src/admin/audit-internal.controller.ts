import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { AuditServiceKeyGuard } from './audit-service-key.guard';
import { IframeContextService } from './iframe-context.service';

/**
 * Internal, shared-key-gated route the private audit service calls to exchange
 * an opaque iframe ctx for its payload. Separate from AdminController so the
 * `/api/internal/...` prefix and the key-only guard stay clearly isolated from
 * the user-facing admin routes.
 */
@Controller('api/internal/audit')
export class AuditInternalController {
  constructor(private readonly contexts: IframeContextService) {}

  @UseGuards(AuditServiceKeyGuard)
  @Get('context/:ctx')
  resolveContext(@Param('ctx') ctx: string) {
    const payload = this.contexts.consume(ctx);
    if (!payload) {
      // 404 → the audit service treats this as "expired/already used".
      throw new NotFoundException('context not found');
    }
    return payload;
  }
}
