CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "content_type" AS ENUM('video', 'article');--> statement-breakpoint
CREATE TABLE "chunk" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"content_id" uuid NOT NULL,
	"start_position" integer,
	"embedding" vector(768),
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"title" text NOT NULL,
	"description" text NOT NULL,
	"publish_date" date NOT NULL,
	"url" text NOT NULL UNIQUE,
	"thumbnail_url" text,
	"type" "content_type" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chunk_contentId_idx" ON "chunk" ("content_id");--> statement-breakpoint
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_content_id_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content"("id") ON DELETE CASCADE;