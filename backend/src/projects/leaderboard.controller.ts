import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HackatimeService } from '../hackatime/hackatime.service';
import { User } from '../entities/user.entity';
import { ProjectsService } from './projects.service';

type LeaderboardEntry = { name: string; hours: number };

@Controller('api/leaderboard')
export class LeaderboardController {
  // Computing the full leaderboard requires one Hackatime /projects call per
  // builder, so pagination caches the sorted list for a short window. Every
  // "show more" click hits the cache rather than re-fanning out to Hackatime.
  private cache: {
    entries: LeaderboardEntry[];
    totalUsers: number;
    timestamp: number;
  } | null = null;
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly hackatimeService: HackatimeService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Returns a paginated slice of the leaderboard, sorted by approved Hackatime
   * hours descending. `limit` defaults to 10, capped at 100. No PII is exposed
   * — only display names and hours.
   */
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Get()
  async getLeaderboard(
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw ?? '', 10) || 10));
    const offset = Math.max(0, Number.parseInt(offsetRaw ?? '', 10) || 0);

    const { entries, totalUsers } = await this.getEntries();

    return {
      leaderboard: entries.slice(offset, offset + limit),
      totalUsers,
      total: entries.length,
      offset,
      limit,
    };
  }

  private async getEntries(): Promise<{ entries: LeaderboardEntry[]; totalUsers: number }> {
    if (this.cache && Date.now() - this.cache.timestamp < LeaderboardController.CACHE_TTL_MS) {
      return { entries: this.cache.entries, totalUsers: this.cache.totalUsers };
    }

    const [grouped, totalUsers] = await Promise.all([
      this.projectsService.findApprovedProjectsGroupedByUser(),
      this.userRepo.count(),
    ]);

    const results = await Promise.allSettled(
      Array.from(grouped.entries()).map(async ([, entry]) => {
        const allNames = [
          ...new Set(entry.projects.flatMap((p) => p.hackatimeProjectNames)),
        ];
        const { perProject } = await this.hackatimeService.getHoursForProjects(
          entry.hcaSub,
          allNames,
        );
        // Approved hours per project = min(overrideHours, hackatime hours on its names).
        // Mirrors the per-user calc in projects.controller.ts#getHours so the
        // leaderboard shows what was actually locked in at approval, not raw logged time.
        let hours = 0;
        for (const proj of entry.projects) {
          let projHours = 0;
          for (const name of proj.hackatimeProjectNames) {
            projHours += perProject[name] ?? 0;
          }
          hours += Math.min(proj.overrideHours, projHours);
        }
        return {
          name: entry.nickname || entry.name || 'Anonymous',
          hours,
        };
      }),
    );

    const entries: LeaderboardEntry[] = results
      .filter(
        (r): r is PromiseFulfilledResult<LeaderboardEntry> =>
          r.status === 'fulfilled' && r.value.hours > 0,
      )
      .map((r) => r.value)
      .sort((a, b) => b.hours - a.hours);

    this.cache = { entries, totalUsers, timestamp: Date.now() };
    return { entries, totalUsers };
  }
}
