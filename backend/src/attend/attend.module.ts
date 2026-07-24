import { Module } from '@nestjs/common';
import { AttendService } from './attend.service';

@Module({
  providers: [AttendService],
  exports: [AttendService],
})
export class AttendModule {}
