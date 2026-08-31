import { createApp } from "./app.ts";
import { loadEnv } from "./env.ts";

await loadEnv();

const app = createApp();
const port = Number(Deno.env.get("PORT") ?? 8000);

if (import.meta.main) {
  Deno.serve({ port }, app.fetch);
  console.log(`ChatGPA API listening on http://localhost:${port}`);
}
