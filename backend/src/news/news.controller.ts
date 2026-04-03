import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsItem } from '../entities/news-item.entity';

@Controller('api/news')
export class NewsController {
  constructor(
    @InjectRepository(NewsItem)
    private readonly newsRepo: Repository<NewsItem>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list() {
    return this.newsRepo.find({
      order: { displayDate: 'DESC', createdAt: 'DESC' },
      select: ['id', 'text', 'displayDate'],
    });
  }
}
