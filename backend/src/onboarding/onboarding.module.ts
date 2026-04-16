import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { HackatimeModule } from '../hackatime/hackatime.module';
import { SlackModule } from '../slack/slack.module';
import { ProjectsModule } from '../projects/projects.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { User } from '../entities/user.entity';
import { Project } from '../entities/project.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingBackfillService } from './onboarding-backfill.service';

@Module({
  imports: [AuthModule, HackatimeModule, SlackModule, ProjectsModule, RsvpModule, TypeOrmModule.forFeature([User, Project])],
  controllers: [OnboardingController],
  providers: [OnboardingBackfillService],
})
export class OnboardingModule {}
