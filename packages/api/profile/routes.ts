import { Hono } from "hono";
import type { AppDatabase } from "../db/client.ts";
import type { TimeProfile } from "@chatgpa/core";
import { getProfile, ProfileError, updateProfile } from "./service.ts";

export function createProfileRoutes(getDatabase: () => AppDatabase | null) {
  const profile = new Hono();

  profile.get("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    try {
      const data = await getProfile(db);
      return c.json(data);
    } catch (err) {
      return profileErrorResponse(c, err);
    }
  });

  profile.put("/", async (c) => {
    const db = getDatabase();
    if (!db) return c.json({ error: "DATABASE_URL nie jest skonfigurowane" }, 503);

    const body = await c.req.json<Partial<TimeProfile>>().catch(() => null);
    if (!body) return c.json({ error: "Nieprawidłowy JSON" }, 400);

    try {
      const data = await updateProfile(db, body);
      return c.json(data);
    } catch (err) {
      return profileErrorResponse(c, err);
    }
  });

  return profile;
}

function profileErrorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  err: unknown,
) {
  if (err instanceof ProfileError) {
    return c.json({ error: err.message }, err.status);
  }
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
}
