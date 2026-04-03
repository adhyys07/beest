import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NewsItem } from '../entities/news-item.entity';
import { NewsController } from './news.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NewsItem]), AuthModule],
  controllers: [NewsController],
})
export class NewsModule {}
