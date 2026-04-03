import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectStatus1775169229562 implements MigrationInterface {
    name = 'AddProjectStatus1775169229562'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "status" character varying(20) NOT NULL DEFAULT 'unshipped'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "status"`);
    }

}
