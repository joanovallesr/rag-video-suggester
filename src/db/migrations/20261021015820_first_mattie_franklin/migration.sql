CREATE TABLE "skipped_video" (
	"video_id" text PRIMARY KEY,
	"reason" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
