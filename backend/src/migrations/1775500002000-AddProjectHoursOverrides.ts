import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectHoursOverrides1775500002000 implements MigrationInterface {
    name = 'AddProjectHoursOverrides1775500002000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "override_hours" real`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "internal_hours" real`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "internal_hours"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "override_hours"`);
    }
}
