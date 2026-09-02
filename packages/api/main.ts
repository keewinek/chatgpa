import { createApp } from "./app.ts";
import { loadEnv } from "./env.ts";
import { registerPlanCronJobs } from "./plan/cron.ts";
import { registerNotificationCronJobs } from "./notifications/cron.ts";

await loadEnv();

const app = createApp();
const port = Number(Deno.env.get("PORT") ?? 8000);

if (import.meta.main) {
  registerPlanCronJobs();
  registerNotificationCronJobs();
  Deno.serve({ port }, app.fetch);
  console.log(`ChatGPA API listening on http://localhost:${port}`);
}
