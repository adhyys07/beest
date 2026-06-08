import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { IframeContextService, type AuditIframeContext } from './iframe-context.service';
import { AuditServiceKeyGuard } from './audit-service-key.guard';

const payload = (): AuditIframeContext => ({
  projectId: 'proj-1',
  projectName: 'Demo',
  hackatimeUserId: 'U1',
  projectNames: ['demo'],
});

describe('IframeContextService', () => {
  it('mints an opaque hex ctx the audit service will accept', () => {
    const svc = new IframeContextService();
    const ctx = svc.mint(payload());
    // The audit service validates /^[a-f0-9]{16,128}$/ before resolving.
    expect(ctx).toMatch(/^[a-f0-9]{16,128}$/);
  });

  it('resolves a ctx to its payload exactly once (single-use)', () => {
    const svc = new IframeContextService();
    const ctx = svc.mint(payload());
    expect(svc.consume(ctx)).toMatchObject({ projectId: 'proj-1', projectNames: ['demo'] });
    // Burned — a replay returns null so a leaked ctx can't be reused.
    expect(svc.consume(ctx)).toBeNull();
  });

  it('returns null for an unknown ctx', () => {
    const svc = new IframeContextService();
    expect(svc.consume('deadbeef'.repeat(4))).toBeNull();
  });

  it('mints distinct ctx ids', () => {
    const svc = new IframeContextService();
    const a = svc.mint(payload());
    const b = svc.mint(payload());
    expect(a).not.toEqual(b);
  });
});

describe('AuditServiceKeyGuard', () => {
  const ctxWith = (key?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: key === undefined ? {} : { 'x-audit-key': key } }),
      }),
    }) as unknown as ExecutionContext;

  const guard = (expected?: string) =>
    new AuditServiceKeyGuard({ get: () => expected } as never);

  it('allows the request when X-Audit-Key matches', () => {
    expect(guard('s3cret').canActivate(ctxWith('s3cret'))).toBe(true);
  });

  it('rejects a wrong key', () => {
    expect(() => guard('s3cret').canActivate(ctxWith('nope'))).toThrow(UnauthorizedException);
  });

  it('rejects a missing key', () => {
    expect(() => guard('s3cret').canActivate(ctxWith(undefined))).toThrow(UnauthorizedException);
  });

  it('rejects when the server has no key configured (fail closed)', () => {
    expect(() => guard(undefined).canActivate(ctxWith('anything'))).toThrow(UnauthorizedException);
  });

  it('rejects a key of different length without throwing on the compare', () => {
    expect(() => guard('s3cret').canActivate(ctxWith('s3cret-longer'))).toThrow(UnauthorizedException);
  });
});
