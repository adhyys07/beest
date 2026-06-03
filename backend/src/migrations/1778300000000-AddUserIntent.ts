import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIntent1778300000000 implements MigrationInterface {
    name = 'AddUserIntent1778300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Answer to the one-time home "hackathon or shop?" prompt. NULL until answered.
        await queryRunner.query(`ALTER TABLE "users" ADD "intent" varchar(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "intent"`);
    }
}
