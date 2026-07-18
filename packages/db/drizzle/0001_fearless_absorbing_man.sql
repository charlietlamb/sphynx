CREATE TABLE "finding_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_repo" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finding_state" ADD CONSTRAINT "finding_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_repo" ADD CONSTRAINT "tracked_repo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finding_state_user_fingerprint_idx" ON "finding_state" USING btree ("user_id","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "tracked_repo_user_repo_idx" ON "tracked_repo" USING btree ("user_id","owner","repo");