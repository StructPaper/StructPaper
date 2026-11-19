CREATE TABLE "article_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"labels" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_article_types_status" CHECK ("article_types"."status" in ('active','archived')),
	CONSTRAINT "chk_article_types_code" CHECK ("article_types"."code" ~ '^[a-z][a-z0-9-]{1,49}$')
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_en" varchar(255),
	"short_name" varchar(20) NOT NULL,
	"color" varchar(7) NOT NULL,
	"issn" varchar(9),
	"latex_cls" varchar(100) DEFAULT 'structpaper-std.cls' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journals_slug_unique" UNIQUE("slug"),
	CONSTRAINT "journals_code_unique" UNIQUE("code"),
	CONSTRAINT "chk_journals_status" CHECK ("journals"."status" in ('draft','published','archived')),
	CONSTRAINT "chk_journals_color" CHECK ("journals"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "chk_journals_issn" CHECK ("journals"."issn" is null or "journals"."issn" ~ '^[0-9]{4}-[0-9]{3}[0-9Xx]$')
);
--> statement-breakpoint
CREATE TABLE "profile_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" varchar(20) NOT NULL,
	"journal_id" uuid,
	"article_type_id" uuid,
	"version" integer NOT NULL,
	"state" varchar(20) DEFAULT 'draft' NOT NULL,
	"config" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"change_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "chk_profile_scope_type" CHECK ("profile_versions"."scope_type" in ('base','journal','article_type')),
	CONSTRAINT "chk_profile_state" CHECK ("profile_versions"."state" in ('draft','validated','published','archived')),
	CONSTRAINT "chk_profile_scope" CHECK (("profile_versions"."scope_type" = 'base' and "profile_versions"."journal_id" is null and "profile_versions"."article_type_id" is null)
        or ("profile_versions"."scope_type" = 'journal' and "profile_versions"."journal_id" is not null and "profile_versions"."article_type_id" is null)
        or ("profile_versions"."scope_type" = 'article_type' and "profile_versions"."journal_id" is null and "profile_versions"."article_type_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" varchar(255),
	"display_name" varchar(255),
	"avatar_url" varchar(1024),
	"status" varchar(50) DEFAULT 'INVITED' NOT NULL,
	"permissions_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(100) NOT NULL,
	"subject" varchar(100) NOT NULL,
	"conditions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_journal_id" uuid DEFAULT '00000000-0000-0000-0000-000000000000' NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_scope_journal_id_pk" PRIMARY KEY("user_id","role_id","scope_journal_id")
);
--> statement-breakpoint
CREATE TABLE "manuscript_members" (
	"manuscript_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manuscript_members_manuscript_id_user_id_pk" PRIMARY KEY("manuscript_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "manuscript_profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"pin" jsonb NOT NULL,
	"resolved" jsonb NOT NULL,
	"hash" varchar(64) NOT NULL,
	"reason" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscript_visits" (
	"user_id" uuid NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"last_opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manuscript_visits_user_id_manuscript_id_pk" PRIMARY KEY("user_id","manuscript_id")
);
--> statement-breakpoint
CREATE TABLE "manuscripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"article_type_id" uuid,
	"profile_pin" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"title" varchar(500) NOT NULL,
	"abstract" text,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"general_access" varchar(20) DEFAULT 'RESTRICTED' NOT NULL,
	"created_by" uuid NOT NULL,
	"current_server_rev" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_manuscripts_profile_pin" CHECK (jsonb_typeof("manuscripts"."profile_pin") = 'object')
);
--> statement-breakpoint
CREATE TABLE "manuscript_docs" (
	"manuscript_id" uuid PRIMARY KEY NOT NULL,
	"doc_tree" jsonb NOT NULL,
	"server_rev" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscript_ops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"server_rev" integer NOT NULL,
	"client_rev" integer NOT NULL,
	"op_id" uuid NOT NULL,
	"patches" jsonb NOT NULL,
	"checksum" varchar(64),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manuscript_ops_op_id_unique" UNIQUE("op_id")
);
--> statement-breakpoint
CREATE TABLE "manuscript_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"server_rev" integer NOT NULL,
	"tag_name" varchar(255),
	"snapshot" jsonb NOT NULL,
	"checksum" varchar(64),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid,
	"filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "compile_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"revision_id" uuid,
	"server_rev" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'QUEUED' NOT NULL,
	"engine" varchar(50) DEFAULT 'XELATEX' NOT NULL,
	"log_output" text,
	"pdf_asset_id" uuid,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response_body" jsonb,
	"status_code" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"payload" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_types" ADD CONSTRAINT "article_types_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_article_type_id_article_types_id_fk" FOREIGN KEY ("article_type_id") REFERENCES "public"."article_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_members" ADD CONSTRAINT "manuscript_members_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_members" ADD CONSTRAINT "manuscript_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_profile_snapshots" ADD CONSTRAINT "manuscript_profile_snapshots_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_visits" ADD CONSTRAINT "manuscript_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_visits" ADD CONSTRAINT "manuscript_visits_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_article_type_id_article_types_id_fk" FOREIGN KEY ("article_type_id") REFERENCES "public"."article_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_docs" ADD CONSTRAINT "manuscript_docs_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_ops" ADD CONSTRAINT "manuscript_ops_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_ops" ADD CONSTRAINT "manuscript_ops_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD CONSTRAINT "manuscript_revisions_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD CONSTRAINT "manuscript_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compile_jobs" ADD CONSTRAINT "compile_jobs_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compile_jobs" ADD CONSTRAINT "compile_jobs_revision_id_manuscript_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manuscript_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compile_jobs" ADD CONSTRAINT "compile_jobs_pdf_asset_id_assets_id_fk" FOREIGN KEY ("pdf_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_article_types_code" ON "article_types" USING btree ("journal_id","code");--> statement-breakpoint
CREATE INDEX "idx_journals_sort" ON "journals" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_profile_version_journal" ON "profile_versions" USING btree ("journal_id","version") WHERE "profile_versions"."scope_type" = 'journal';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_profile_version_article_type" ON "profile_versions" USING btree ("article_type_id","version") WHERE "profile_versions"."scope_type" = 'article_type';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_profile_version_base" ON "profile_versions" USING btree ("version") WHERE "profile_versions"."scope_type" = 'base';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_profile_published_journal" ON "profile_versions" USING btree ("journal_id") WHERE "profile_versions"."state" = 'published' and "profile_versions"."scope_type" = 'journal';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_profile_published_article_type" ON "profile_versions" USING btree ("article_type_id") WHERE "profile_versions"."state" = 'published' and "profile_versions"."scope_type" = 'article_type';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_profile_published_base" ON "profile_versions" USING btree ("scope_type") WHERE "profile_versions"."state" = 'published' and "profile_versions"."scope_type" = 'base';--> statement-breakpoint
CREATE INDEX "idx_profile_versions_journal" ON "profile_versions" USING btree ("journal_id","version");--> statement-breakpoint
CREATE INDEX "idx_profile_snapshots_ms" ON "manuscript_profile_snapshots" USING btree ("manuscript_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_manuscripts_journal" ON "manuscripts" USING btree ("journal_id");--> statement-breakpoint
-- A published (or archived) profile version is history that papers are pinned to: its rules never change and it is
-- never deleted by hand. Only the state may move on (published -> archived).
CREATE FUNCTION "profile_versions_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."state" IN ('published','archived') THEN
      RAISE EXCEPTION 'profile version % is % and cannot be deleted', OLD."id", OLD."state";
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."state" IN ('published','archived') AND (
       NEW."config" IS DISTINCT FROM OLD."config" OR NEW."scope_type" <> OLD."scope_type"
       OR NEW."journal_id" IS DISTINCT FROM OLD."journal_id"
       OR NEW."article_type_id" IS DISTINCT FROM OLD."article_type_id"
       OR NEW."version" <> OLD."version" OR NEW."schema_version" <> OLD."schema_version") THEN
    RAISE EXCEPTION 'profile version % is % and its rules are immutable', OLD."id", OLD."state";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_profile_versions_guard" BEFORE UPDATE OR DELETE ON "profile_versions"
  FOR EACH ROW EXECUTE FUNCTION "profile_versions_guard"();
