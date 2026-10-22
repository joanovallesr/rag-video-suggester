CREATE TABLE "search_query" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"query_text" text NOT NULL,
	"user_id" uuid NOT NULL,
	"result_content_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "search_query_userId_createdAt_idx" ON "search_query" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "search_query" ADD CONSTRAINT "search_query_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;