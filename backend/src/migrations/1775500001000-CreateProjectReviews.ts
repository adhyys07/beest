import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectReviews1775500001000 implements MigrationInterface {
    name = 'CreateProjectReviews1775500001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "project_reviews" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "project_id" uuid NOT NULL,
                "reviewer_id" uuid NOT NULL,
                "status" varchar(20) NOT NULL,
                "feedback" text,
                "internal_note" text,
                "override_justification" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_project_reviews" PRIMARY KEY ("id"),
                CONSTRAINT "FK_project_reviews_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_project_reviews_reviewer" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_project_reviews_project_id" ON "project_reviews" ("project_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "project_reviews"`);
    }
}
