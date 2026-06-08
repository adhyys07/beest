import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Short-lived, single-use context store for the private audit iframe service.
 *
 * When a reviewer opens a project, we mint an opaque ctx id that maps to the
 * minimal payload the audit service needs ({hackatimeUserId, projectNames}).
 * The browser only ever sees the opaque id; the audit service exchanges it
 * server-to-server (behind the shared key) for the payload, which is then
 * burned. Entries also expire on a TTL so an unused ctx can't linger.
 */

export interface AuditIframeContext {
  projectId: string;
  projectName: string | null;
  hackatimeUserId: string | null;
  projectNames: string[];
  // Only populated when AUDIT_SVC_INCLUDE_TOKEN is on (token-fallback opt-in).
  hackatimeToken?: string | null;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class IframeContextService {
  private readonly logger = new Logger(IframeContextService.name);
  private readonly store = new Map<
    string,
    { payload: AuditIframeContext; expiresAt: number }
  >();

  /** Create an opaque single-use ctx id for the given payload. */
  mint(payload: AuditIframeContext): string {
    this.sweep();
    // 24 bytes → 48 hex chars; within the audit service's [16,128] hex bound.
    const ctx = randomBytes(24).toString('hex');
    this.store.set(ctx, { payload, expiresAt: Date.now() + TTL_MS });
    return ctx;
  }

  /** Resolve + burn a ctx. Returns null if unknown, expired, or already used. */
  consume(ctx: string): AuditIframeContext | null {
    const entry = this.store.get(ctx);
    if (!entry) return null;
    this.store.delete(ctx); // single-use: gone whether or not it was expired
    if (entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }

  /** Drop expired entries. Cheap; called on each mint. */
  private sweep(): void {
    const now = Date.now();
    for (const [ctx, entry] of this.store) {
      if (entry.expiresAt < now) this.store.delete(ctx);
    }
  }
}
