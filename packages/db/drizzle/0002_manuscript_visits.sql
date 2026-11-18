CREATE TABLE "manuscript_visits" (
	"user_id" uuid NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"last_opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manuscript_visits_user_id_manuscript_id_pk" PRIMARY KEY("user_id","manuscript_id")
);
--> statement-breakpoint
ALTER TABLE "manuscript_visits" ADD CONSTRAINT "manuscript_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_visits" ADD CONSTRAINT "manuscript_visits_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;