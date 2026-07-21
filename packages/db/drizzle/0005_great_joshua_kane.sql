ALTER TABLE "github_installation" ADD COLUMN "pipeline_etag" text;--> statement-breakpoint
ALTER TABLE "github_installation" ADD COLUMN "reconciled_at" timestamp;--> statement-breakpoint
CREATE INDEX "pull_head_head_sha_idx" ON "pull_head" USING btree ("owner","repo","head_sha");