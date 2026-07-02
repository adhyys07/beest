import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderFulfillmentNote1782600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" ADD COLUMN "fulfillment_notes" varchar(500) `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "fulfillment_notes"`);
  }
}