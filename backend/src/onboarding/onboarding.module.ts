import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HackatimeModule } from '../hackatime/hackatime.module';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [AuthModule, HackatimeModule],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
