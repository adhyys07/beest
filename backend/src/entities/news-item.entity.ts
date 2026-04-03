import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('news_items')
export class NewsItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500 })
  text: string;

  @Column({ name: 'display_date', type: 'date' })
  displayDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
