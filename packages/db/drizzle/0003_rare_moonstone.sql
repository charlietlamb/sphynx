CREATE TABLE "pull_head" (
	"installation_id" integer NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"head_sha" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "pull_head_owner_repo_number_pk" PRIMARY KEY("owner","repo","number")
);
--> statement-breakpoint
CREATE TABLE "review_check" (
	"pull_id" text NOT NULL,
	"name" text NOT NULL,
	"bucket" text NOT NULL,
	"details_url" text,
	"completed_at" timestamp,
	CONSTRAINT "review_check_pull_id_name_pk" PRIMARY KEY("pull_id","name")
);
--> statement-breakpoint
CREATE TABLE "review_pull" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"number" integer NOT NULL,
	"state" text NOT NULL,
	"title" text NOT NULL,
	"author_login" text,
	"author_avatar_url" text,
	"is_draft" boolean DEFAULT false NOT NULL,
	"has_body" boolean DEFAULT false NOT NULL,
	"base_ref" text NOT NULL,
	"head_ref" text NOT NULL,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"changed_files" integer DEFAULT 0 NOT NULL,
	"ci_state" text DEFAULT 'none' NOT NULL,
	"decision" text NOT NULL,
	"blocker" text,
	"merged_at" timestamp,
	"gh_updated_at" timestamp NOT NULL,
	"fetched_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_repo" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" integer NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"default_branch" text,
	"stages" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reviewer" (
	"pull_id" text NOT NULL,
	"login" text NOT NULL,
	"kind" text NOT NULL,
	"avatar_url" text,
	"state" text NOT NULL,
	"score" text,
	"submitted_at" timestamp,
	CONSTRAINT "review_reviewer_pull_id_login_pk" PRIMARY KEY("pull_id","login")
);
--> statement-breakpoint
CREATE TABLE "review_thread" (
	"pull_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"path" text,
	"root_comment_id" bigint,
	"author_login" text,
	"author_avatar_url" text,
	"body_preview" text NOT NULL,
	CONSTRAINT "review_thread_pull_id_thread_id_pk" PRIMARY KEY("pull_id","thread_id")
);
--> statement-breakpoint
CREATE TABLE "stage_gap" (
	"repo_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"from_stage" text NOT NULL,
	"to_stage" text NOT NULL,
	"ahead_by" integer DEFAULT 0 NOT NULL,
	"direct_commits" integer DEFAULT 0 NOT NULL,
	"promotion_pull" integer,
	"computed_at" timestamp NOT NULL,
	CONSTRAINT "stage_gap_repo_id_from_stage_to_stage_pk" PRIMARY KEY("repo_id","from_stage","to_stage")
);
--> statement-breakpoint
CREATE TABLE "stage_gap_pull" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"from_stage" text NOT NULL,
	"to_stage" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"author_login" text,
	"author_avatar_url" text,
	"merged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"installation_id" integer,
	"received_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbench_event" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" integer NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"kind" text NOT NULL,
	"actor" text,
	"pull_number" integer,
	"title" text,
	"detail" text,
	"occurred_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_check" ADD CONSTRAINT "review_check_pull_id_review_pull_id_fk" FOREIGN KEY ("pull_id") REFERENCES "public"."review_pull"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_pull" ADD CONSTRAINT "review_pull_repo_id_review_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."review_repo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reviewer" ADD CONSTRAINT "review_reviewer_pull_id_review_pull_id_fk" FOREIGN KEY ("pull_id") REFERENCES "public"."review_pull"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_thread" ADD CONSTRAINT "review_thread_pull_id_review_pull_id_fk" FOREIGN KEY ("pull_id") REFERENCES "public"."review_pull"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_gap" ADD CONSTRAINT "stage_gap_repo_id_review_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."review_repo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pull_head_installation_idx" ON "pull_head" USING btree ("installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_pull_repo_number_idx" ON "review_pull" USING btree ("repo_id","number");--> statement-breakpoint
CREATE INDEX "review_pull_open_idx" ON "review_pull" USING btree ("installation_id") WHERE "review_pull"."state" = 'open';--> statement-breakpoint
CREATE INDEX "review_pull_repo_idx" ON "review_pull" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_repo_owner_repo_idx" ON "review_repo" USING btree ("installation_id","owner","repo");--> statement-breakpoint
CREATE INDEX "review_repo_installation_idx" ON "review_repo" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "stage_gap_installation_idx" ON "stage_gap" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "stage_gap_pull_gap_idx" ON "stage_gap_pull" USING btree ("repo_id","from_stage","to_stage");--> statement-breakpoint
CREATE INDEX "webhook_delivery_received_idx" ON "webhook_delivery" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "workbench_event_feed_idx" ON "workbench_event" USING btree ("installation_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workbench_event_repo_idx" ON "workbench_event" USING btree ("installation_id","owner","repo","occurred_at" DESC NULLS LAST);