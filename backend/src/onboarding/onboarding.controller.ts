import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HackatimeService } from '../hackatime/hackatime.service';

@Controller('api/onboarding')
export class OnboardingController {
  constructor(private readonly hackatimeService: HackatimeService) {}

  /**
   * Returns completion status for each onboarding step.
   * The frontend uses this to show "Complete! Move on?" vs action buttons.
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req: Request) {
    const user = (req as any).user;

    return {
      hackatime: await this.hackatimeService.isConnected(user.sub),
      slack: !!user.slack_id,
      project: false, // TODO: implement project creation tracking
    };
  }
}
