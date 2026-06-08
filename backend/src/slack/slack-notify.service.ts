import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../fetch.util';

type SlackBlock = Record<string, unknown>;

/**
 * Outbound-only Slack DM sender for builder notifications (review decisions,
 * order fulfillment, fraud review). Deliberately a SEPARATE service from
 * {@link SlackService} so it uses its own dedicated app token
 * (`SLACK_NOTIFY_BOT_TOKEN`) rather than the membership-check app's token.
 *
 * Every method is best-effort: it logs and returns false on failure instead of
 * throwing, so a Slack hiccup never breaks the review/order flow that triggered
 * it. Needs only the `chat:write` and `im:write` bot scopes.
 */
@Injectable()
export class SlackNotifyService {
  private readonly logger = new Logger(SlackNotifyService.name);
  private readonly botToken: string | undefined;
  private readonly configured: boolean;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get('SLACK_NOTIFY_BOT_TOKEN');
    this.configured = !!this.botToken;
    if (!this.configured) {
      this.logger.warn(
        'SLACK_NOTIFY_BOT_TOKEN not set; Slack DM notifications disabled',
      );
    }
  }

  /** Low-level Slack Web API POST. Returns the parsed body, or null on any failure. */
  private async call(method: string, body: Record<string, unknown>) {
    if (!this.configured) return null;
    try {
      const res = await fetchWithTimeout(`https://slack.com/api/${method}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.error(`Slack ${method} HTTP ${res.status}`);
        return null;
      }
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        this.logger.error(`Slack ${method} error: ${data?.error ?? 'unknown'}`);
        return null;
      }
      return data;
    } catch (err) {
      this.logger.error(
        `Slack ${method} request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** Opens (or returns) the DM channel id for a Slack user. */
  private async openDm(slackId: string): Promise<string | null> {
    const data = await this.call('conversations.open', { users: slackId });
    const channel = data?.channel?.id;
    return typeof channel === 'string' ? channel : null;
  }

  /**
   * Sends a DM to a Slack user. `text` is the notification/fallback text;
   * `blocks` is optional Block Kit. Returns true only if Slack accepted the
   * message. Safe to call with a missing slackId or unconfigured token.
   */
  async dm(
    slackId: string | null | undefined,
    text: string,
    blocks?: SlackBlock[],
  ): Promise<boolean> {
    if (!this.configured || !slackId) return false;
    const channel = await this.openDm(slackId);
    if (!channel) return false;
    const data = await this.call('chat.postMessage', {
      channel,
      text,
      ...(blocks ? { blocks } : {}),
    });
    return !!data;
  }
}
