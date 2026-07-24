import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../fetch.util';

/**
 * Outbound integration with Attend (https://github.com/hackclub/attend) —
 * invites a participant to the in-person event once they buy their ticket.
 * Best-effort like SlackNotifyService: logs and returns false on any
 * failure rather than throwing, so a downed Attend never blocks a purchase.
 */
@Injectable()
export class AttendService {
  private readonly logger = new Logger(AttendService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly eventSlug: string | undefined;
  private readonly configured: boolean;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get('ATTEND_BASE_URL') ??
      'https://attend.hackclub.com';
    this.apiKey = this.configService.get('ATTEND_API_KEY');
    this.eventSlug = this.configService.get('ATTEND_EVENT_SLUG');
    this.configured = !!this.apiKey && !!this.eventSlug;
    if (!this.configured) {
      this.logger.warn(
        'ATTEND_API_KEY / ATTEND_EVENT_SLUG not set; Attend invites disabled',
      );
    }
  }

  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 1000;

  /**
   * Invites a participant to the Attend event by email. A 409 (already
   * invited/registered) counts as success — the goal (an invite exists)
   * already holds. Retries transient failures (network errors, non-409
   * non-2xx responses) up to MAX_ATTEMPTS times before giving up. Returns
   * false only once every attempt has failed, or when unconfigured — the
   * caller is responsible for surfacing that loudly, since a false here
   * means a paying participant did not get invited.
   */
  async inviteParticipant(
    email: string,
    name?: string | null,
  ): Promise<boolean> {
    if (!this.configured) return false;

    const [firstName, ...rest] = (name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const lastName = rest.join(' ');

    let lastError = '';
    for (let attempt = 1; attempt <= AttendService.MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetchWithTimeout(
          `${this.baseUrl}/api/v1/events/${this.eventSlug}/participants`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              ...(firstName ? { first_name: firstName } : {}),
              ...(lastName ? { last_name: lastName } : {}),
            }),
          },
        );

        if (res.ok || res.status === 409) return true;

        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (attempt < AttendService.MAX_ATTEMPTS) {
        await new Promise((r) =>
          setTimeout(r, AttendService.RETRY_DELAY_MS * attempt),
        );
      }
    }

    this.logger.error(
      `Attend invite failed for ${email} after ${AttendService.MAX_ATTEMPTS} attempts: ${lastError}`,
    );
    return false;
  }
}
