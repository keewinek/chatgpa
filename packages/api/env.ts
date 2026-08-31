import { loadSync } from "@std/dotenv";
import { fromFileUrl } from "@std/path/from-file-url";

/** Load repo-root `.env` without overriding existing process env. */
export function loadEnv() {
  const envPath = fromFileUrl(new URL("../../.env", import.meta.url));
  try {
    loadSync({ envPath, export: false });
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
}
