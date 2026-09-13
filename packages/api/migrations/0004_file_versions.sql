CREATE TABLE IF NOT EXISTS "file_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"seq" serial NOT NULL,
	"path" text NOT NULL,
	"content" text,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_versions_path_idx" ON "file_versions" USING btree ("path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_versions_path_seq_idx" ON "file_versions" USING btree ("path","seq");
