import { Module } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackNotifyService } from './slack-notify.service';

@Module({
  providers: [SlackService, SlackNotifyService],
  exports: [SlackService, SlackNotifyService],
})
export class SlackModule {}
