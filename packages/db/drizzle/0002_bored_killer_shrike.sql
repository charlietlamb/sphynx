CREATE TABLE "github_installation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"installation_id" integer NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"avatar_url" text,
	"repository_selection" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_installation" ADD CONSTRAINT "github_installation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_installation_installation_id_idx" ON "github_installation" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "github_installation_organization_id_idx" ON "github_installation" USING btree ("organization_id");