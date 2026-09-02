CREATE TABLE IF NOT EXISTS "profile" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"class_name" text,
	"target_overall_average" real DEFAULT 4.5 NOT NULL,
	"daily_study_minutes" integer DEFAULT 120 NOT NULL,
	"quiet_hours" jsonb,
	"weak_subjects" jsonb,
	"timezone" text DEFAULT 'Europe/Warsaw' NOT NULL,
	"locale" text DEFAULT 'pl' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"mode" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone,
	"source" text NOT NULL,
	"tags" jsonb,
	"chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subject_id" text,
	"due_date" date,
	"priority" text DEFAULT 'medium' NOT NULL,
	"roi_score" real,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"estimated_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "file_nodes_path_unique" UNIQUE("path")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_thread_id_idx" ON "chat_messages" USING btree ("thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_threads_updated_at_idx" ON "chat_threads" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_updated_at_idx" ON "chat_messages" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_entries_updated_at_idx" ON "memory_entries" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_updated_at_idx" ON "tasks" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_nodes_updated_at_idx" ON "file_nodes" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_updated_at_idx" ON "profile" USING btree ("updated_at");
