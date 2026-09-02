ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
