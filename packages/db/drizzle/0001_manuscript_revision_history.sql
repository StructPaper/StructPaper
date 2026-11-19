ALTER TABLE "manuscript_revisions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD COLUMN "kind" varchar(30) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD COLUMN "stats" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD COLUMN "size_bytes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_revisions_ms_created" ON "manuscript_revisions" USING btree ("manuscript_id","created_at");