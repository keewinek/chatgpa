import { assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";

const SAMPLE_SYNC = {
  syncedAt: "2026-09-02T12:00:00+02:00",
  subjects: [{
    name: "Chemia",
    grades: [{
      id: "g1",
      subjectName: "Chemia",
      value: 5,
      weight: 3,
      category: "sprawdzian",
      date: "2026-09-01",
    }],
  }],
  exams: [{
    id: "exam1",
    title: "Sprawdzian chemia",
    kind: "exam" as const,
    start: "2026-09-15T08:00:00+02:00",
    source: "librus" as const,
  }],
  homeworks: [{
    id: "hw1",
    title: "Ćwiczenia str. 12",
    dueDate: "2026-09-05",
    priority: "medium" as const,
    status: "open" as const,
    source: "librus" as const,
  }],
  schedule: {
    days: {
      mon: [{ slot: 1, subject: "Chemia", teacher: "Kowalski", room: "101" }],
    },
  },
  timetableChanges: [{
    id: "tc1",
    date: "2026-09-03",
    description: "Zastępstwo — chemia → biologia",
  }],
};

withTestDb("GET /api/librus/status empty", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/librus/status");
    assertEquals(res.status, 200);
    const body = await res.json() as { syncedAt: string | null; stale: boolean };
    assertEquals(body.syncedAt, null);
    assertEquals(body.stale, true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("POST /api/librus/sync writes snapshots and merges calendar", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();

    const syncRes = await app.request("/api/librus/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_SYNC),
    });
    assertEquals(syncRes.status, 200);
    const syncBody = await syncRes.json() as {
      ok: boolean;
      counts: { grades: number; exams: number };
      merge: { newGrades: number };
    };
    assertEquals(syncBody.ok, true);
    assertEquals(syncBody.counts.grades, 1);
    assertEquals(syncBody.merge.newGrades, 1);

    const statusRes = await app.request("/api/librus/status");
    const status = await statusRes.json() as { syncedAt: string | null; stale: boolean };
    assertEquals(status.syncedAt, SAMPLE_SYNC.syncedAt);
    assertEquals(status.stale, false);

    const gradesRes = await app.request(
      "/api/fs/file?path=" + encodeURIComponent("~/school/librus/grades.json"),
    );
    assertEquals(gradesRes.status, 200);
    const gradesFile = await gradesRes.json() as { content: string };
    assertEquals(gradesFile.content.includes("Chemia"), true);

    const calRes = await app.request("/api/calendar?from=2026-09-01&to=2026-09-30");
    const cal = await calRes.json() as { events: Array<{ source: string; title: string }> };
    assertEquals(cal.events.some((e) => e.source === "librus" && e.title.includes("chemia")), true);

    const todoRes = await app.request("/api/todos");
    const todos = await todoRes.json() as { tasks: Array<{ title: string; source: string }> };
    assertEquals(todos.tasks.some((t) => t.source === "librus"), true);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("POST /api/librus/merge-preview without write", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();

    await app.request("/api/librus/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SAMPLE_SYNC),
    });

    const previewRes = await app.request("/api/librus/merge-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...SAMPLE_SYNC,
        syncedAt: "2026-09-02T14:00:00+02:00",
        subjects: [{
          name: "Chemia",
          grades: [
            ...SAMPLE_SYNC.subjects[0].grades,
            {
              id: "g2",
              subjectName: "Chemia",
              value: 4,
              category: "kartkówka",
              date: "2026-09-02",
            },
          ],
        }],
      }),
    });
    assertEquals(previewRes.status, 200);
    const preview = await previewRes.json() as { merge: { newGrades: number } };
    assertEquals(preview.merge.newGrades, 1);
  } finally {
    setDbForTests(undefined);
  }
});

withTestDb("POST /api/librus/sync rejects invalid syncedAt", async ({ db }) => {
  setDbForTests(db);
  try {
    const app = createApp();
    const res = await app.request("/api/librus/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncedAt: "invalid" }),
    });
    assertEquals(res.status, 400);
  } finally {
    setDbForTests(undefined);
  }
});
