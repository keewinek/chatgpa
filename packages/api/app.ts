import { Hono } from "hono";
import type { Subject } from "@chatgpa/core";

export function createApp() {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/api/subjects", (c) => {
    const subjects: Subject[] = [];
    return c.json(subjects);
  });

  return app;
}
