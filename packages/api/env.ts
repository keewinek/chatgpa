import { loadSync } from "@std/dotenv";
import { fromFileUrl } from "@std/path/from-file-url";

/** Load repo-root `.env` into process env (does not override existing vars). */
export function loadEnv() {
  const envPath = fromFileUrl(new URL("../../.env", import.meta.url));
  try {
    loadSync({ envPath, export: true });
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
}
