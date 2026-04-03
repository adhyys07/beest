import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNewsItems1775400000000 implements MigrationInterface {
    name = 'CreateNewsItems1775400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "news_items" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "text" varchar(500) NOT NULL,
                "display_date" date NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_news_items" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "news_items"`);
    }
}
