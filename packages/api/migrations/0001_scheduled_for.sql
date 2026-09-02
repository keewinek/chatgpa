ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scheduled_for" date;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_scheduled_for_idx" ON "tasks" USING btree ("scheduled_for");
