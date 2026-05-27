import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(userId: string, action: AuditAction, label: string, impersonatorName?: string): Promise<void> {
    const prefix = impersonatorName ? `[${impersonatorName} performed an action on your behalf] ` : '';
    const entry = this.auditLogRepo.create({
      userId,
      action,
      label: (prefix + label).replace(/[<>"'`&\\]/g, '').replace(/\0/g, '').trim().slice(0, 255),
    });
    await this.auditLogRepo.save(entry);
  }

  async getForUser(userId: string, limit = 50) {
    return this.auditLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      select: ['id', 'action', 'label', 'createdAt'],
    });
  }

  /**
   * Returns distinct user IDs with at least one `hackatime_ownership_failed`
   * audit log whose label contains any of `labelSubstrings`. Used by the
   * daily Hackatime-recovery cron to find candidates whose linked account
   * was originally flagged as banned/red-trust.
   */
  async findUsersWithOwnershipFailLabels(labelSubstrings: string[]): Promise<string[]> {
    if (labelSubstrings.length === 0) return [];
    const qb = this.auditLogRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.user_id', 'user_id')
      .where("a.action = 'hackatime_ownership_failed'");
    qb.andWhere(
      `(${labelSubstrings.map((_, i) => `a.label LIKE :s${i}`).join(' OR ')})`,
      Object.fromEntries(labelSubstrings.map((s, i) => [`s${i}`, `%${s}%`])),
    );
    const rows = await qb.getRawMany<{ user_id: string }>();
    return rows.map((r) => r.user_id);
  }
}
