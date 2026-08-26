import { createApp } from "./app.ts";
import { fromFileUrl } from "jsr:@std/path@1/from-file-url";

async function loadEnvFile(path: string) {
  try {
    const text = await Deno.readTextFile(path);
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!Deno.env.get(key)) Deno.env.set(key, value);
    }
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
}

await loadEnvFile(fromFileUrl(new URL("../../.env", import.meta.url)));

const app = createApp();
const port = Number(Deno.env.get("PORT") ?? 8000);

if (import.meta.main) {
  Deno.serve({ port }, app.fetch);
  console.log(`ChatGPA API listening on http://localhost:${port}`);
}
