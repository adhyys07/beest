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

  /**
   * Invites a participant to the Attend event by email. A 409 (already
   * invited/registered) counts as success — the goal (an invite exists)
   * already holds. Returns false on any other failure or when unconfigured.
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

      this.logger.error(`Attend invite HTTP ${res.status} for ${email}`);
      return false;
    } catch (err) {
      this.logger.error(
        `Attend invite request failed for ${email}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
