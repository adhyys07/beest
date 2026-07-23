import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchWithTimeout } from '../fetch.util';

export type SlackMembershipStatus = 'full_member' | 'guest' | 'not_found';

type RawSlackUser = {
  name?: unknown;
  profile?: {
    display_name_normalized?: unknown;
    display_name?: unknown;
    real_name_normalized?: unknown;
    real_name?: unknown;
  } | null;
};

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly botToken: string | undefined;
  private readonly configured: boolean;
  private readonly userInfoCache = new Map<string, RawSlackUser | null>();

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get('SLACK_BOT_TOKEN');
    this.configured = !!this.botToken;
    if (!this.configured) {
      this.logger.warn('SLACK_BOT_TOKEN not set — Slack membership checks disabled');
    }
  }

  async checkMembership(email: string): Promise<SlackMembershipStatus> {
    if (!this.configured) {
      throw new Error('Slack integration is not configured');
    }

    const res = await fetchWithTimeout(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${this.botToken}` } },
    );

    if (!res.ok) {
      this.logger.error(`Slack API HTTP error: ${res.status}`);
      throw new Error('Slack API request failed');
    }

    const data = await res.json();

    if (!data.ok) {
      if (data.error === 'users_not_found') {
        return 'not_found';
      }
      this.logger.error(`Slack API error: ${data.error}`);
      throw new Error(`Slack API error: ${data.error}`);
    }

    const user = data.user;
    if (user.is_restricted || user.is_ultra_restricted) {
      return 'guest';
    }

    return 'full_member';
  }

  async getUserDisplayName(slackId: string): Promise<string | null> {
    const user = await this.usersInfo(slackId);
    const profile = user?.profile ?? {};
    return (
      str(user?.name) ||
      str(profile.display_name_normalized) ||
      str(profile.display_name) ||
      str(profile.real_name_normalized) ||
      str(profile.real_name) ||
      null
    );
  }

  /**
   * The user's Slack username (`name` in users.info — the @handle), as
   * opposed to the free-form display name. Null when unresolvable.
   */
  async getUserUsername(slackId: string): Promise<string | null> {
    const user = await this.usersInfo(slackId);
    return str(user?.name) || null;
  }

  private async usersInfo(slackId: string): Promise<RawSlackUser | null> {
    if (!this.configured) {
      return null;
    }
    if (this.userInfoCache.has(slackId)) {
      return this.userInfoCache.get(slackId) ?? null;
    }

    let res: Response;
    try {
      res = await fetchWithTimeout(
        `https://slack.com/api/users.info?user=${encodeURIComponent(slackId)}`,
        { headers: { Authorization: `Bearer ${this.botToken}` } },
      );
    } catch (error) {
      this.logger.error(`Slack users.info request failed for ${slackId}: ${error instanceof Error ? error.message : String(error)}`);
      this.userInfoCache.set(slackId, null);
      return null;
    }

    if (!res.ok) {
      this.logger.error(`Slack users.info HTTP error for ${slackId}: ${res.status}`);
      this.userInfoCache.set(slackId, null);
      return null;
    }

    const data = await res.json();
    if (!data.ok) {
      this.logger.error(`Slack users.info error for ${slackId}: ${data.error}`);
      this.userInfoCache.set(slackId, null);
      return null;
    }

    const user = (data.user ?? null) as RawSlackUser | null;
    this.userInfoCache.set(slackId, user);
    return user;
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
