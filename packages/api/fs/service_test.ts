import { assertEquals, assertStringIncludes } from "@std/assert";
import { withTestDb } from "../db/test-helpers.ts";
import {
  computeLineDiff,
  formatDiffSummary,
  fsGrep,
  fsHistory,
  fsMkdir,
  fsRead,
  fsRestore,
  fsWrite,
} from "./service.ts";

withTestDb("fsGrep finds matches across files with line + snippet", async ({ db }) => {
  await fsMkdir(db, "~/notes/chemia");
  await fsMkdir(db, "~/notes/biologia");
  await fsWrite(db, "~/notes/chemia/kwasy.md", "# Kwasy\nKwas solny to HCl.\nPamiętaj o pH.");
  await fsWrite(db, "~/notes/biologia/mitoza.md", "# Mitoza\nBrak wzmianki o kwasach.");

  const result = await fsGrep(db, "kwas");

  assertEquals(result.query, "kwas");
  assertEquals(result.matches.length >= 2, true);
  const paths = result.matches.map((m) => m.path);
  assertEquals(paths.includes("~/notes/chemia/kwasy.md"), true);
  assertEquals(paths.includes("~/notes/biologia/mitoza.md"), true);
  const solny = result.matches.find((m) => m.snippet.includes("HCl"));
  assertEquals(solny?.line, 2);
});

withTestDb("fsGrep is case-insensitive", async ({ db }) => {
  await fsWrite(db, "~/notes/a.md", "Warszawa jest stolicą Polski.");
  const result = await fsGrep(db, "WARSZAWA");
  assertEquals(result.matches.length, 1);
});

withTestDb("fsGrep returns no matches for absent query", async ({ db }) => {
  await fsWrite(db, "~/notes/a.md", "Nic ciekawego tutaj.");
  const result = await fsGrep(db, "brakujące-słowo-xyz");
  assertEquals(result.matches.length, 0);
});

withTestDb("fsGrep scopes results to a subpath", async ({ db }) => {
  await fsMkdir(db, "~/notes/chemia");
  await fsWrite(db, "~/notes/chemia/kwasy.md", "kwas siarkowy");
  await fsWrite(db, "~/todo/global.todo", "- [ ] przeczytać o kwasach");

  const scoped = await fsGrep(db, "kwas", { path: "~/notes" });
  assertEquals(scoped.matches.length, 1);
  assertEquals(scoped.matches[0].path, "~/notes/chemia/kwasy.md");
});

withTestDb("fsGrep respects and reports limit truncation", async ({ db }) => {
  for (let i = 0; i < 5; i++) {
    await fsWrite(db, `~/notes/note-${i}.md`, "wzmianka o kwasach");
  }

  const result = await fsGrep(db, "kwas", { limit: 2 });
  assertEquals(result.matches.length, 2);
  assertEquals(result.truncated, true);
});

Deno.test("computeLineDiff marks added/removed/unchanged lines", () => {
  const diff = computeLineDiff("a\nb\nc", "a\nx\nc");
  assertEquals(diff, [
    { type: "same", text: "a" },
    { type: "remove", text: "b" },
    { type: "add", text: "x" },
    { type: "same", text: "c" },
  ]);
});

Deno.test("computeLineDiff returns empty array for identical content", () => {
  assertEquals(computeLineDiff("same", "same"), []);
});

Deno.test("formatDiffSummary reports no changes for empty diff", () => {
  assertEquals(formatDiffSummary([]), "(bez zmian w treści)");
});

Deno.test("formatDiffSummary counts added/removed lines", () => {
  const summary = formatDiffSummary(computeLineDiff("a\nb", "a\nb\nc"));
  assertStringIncludes(summary, "+1 -0");
  assertStringIncludes(summary, "+ c");
});

withTestDb("fsWrite returns a diff summary on overwrite, none on create", async ({ db }) => {
  const created = await fsWrite(db, "~/notes/a.md", "wersja 1");
  assertEquals(created.created, true);
  assertEquals(created.diff, null);

  const overwritten = await fsWrite(db, "~/notes/a.md", "wersja 2");
  assertEquals(overwritten.created, false);
  assertStringIncludes(overwritten.diff ?? "", "- wersja 1");
  assertStringIncludes(overwritten.diff ?? "", "+ wersja 2");
});

withTestDb("fsWrite does not version a no-op save", async ({ db }) => {
  await fsWrite(db, "~/notes/a.md", "treść");
  await fsWrite(db, "~/notes/a.md", "treść");

  const history = await fsHistory(db, "~/notes/a.md");
  assertEquals(history.length, 0);
});

withTestDb("fsHistory lists versions newest first, capped at 5", async ({ db }) => {
  await fsWrite(db, "~/notes/a.md", "v0");
  for (let i = 1; i <= 6; i++) {
    await fsWrite(db, "~/notes/a.md", `v${i}`);
  }

  const history = await fsHistory(db, "~/notes/a.md");
  assertEquals(history.length, 5);
  // Newest snapshot first — the content right before the last write ("v5").
  assertEquals(history[0].preview, "v5");
  // Oldest kept snapshot is "v1" — "v0" was pruned once the cap was exceeded.
  assertEquals(history[history.length - 1].preview, "v1");
});

withTestDb("fsRestore brings back the previous content exactly", async ({ db }) => {
  await fsWrite(db, "~/notes/a.md", "oryginał");
  await fsWrite(db, "~/notes/a.md", "zepsute przez pomyłkę");

  const restored = await fsRestore(db, "~/notes/a.md");
  assertEquals(restored.path, "~/notes/a.md");

  const file = await fsRead(db, "~/notes/a.md");
  assertEquals(file.content, "oryginał");
});

withTestDb("fsRestore is itself undoable (current state pushed as a version)", async ({ db }) => {
  await fsWrite(db, "~/notes/a.md", "oryginał");
  await fsWrite(db, "~/notes/a.md", "zmienione");
  await fsRestore(db, "~/notes/a.md");

  const file = await fsRead(db, "~/notes/a.md");
  assertEquals(file.content, "oryginał");

  // Undoing again should bring back "zmienione" — the state right before the restore.
  await fsRestore(db, "~/notes/a.md");
  const again = await fsRead(db, "~/notes/a.md");
  assertEquals(again.content, "zmienione");
});

withTestDb("fsHistory and fsRestore error on missing file/history", async ({ db }) => {
  const emptyHistory = await fsHistory(db, "~/notes/never-written.md");
  assertEquals(emptyHistory.length, 0);

  await fsWrite(db, "~/notes/fresh.md", "tylko jedna wersja");
  try {
    await fsRestore(db, "~/notes/fresh.md");
    throw new Error("expected fsRestore to throw");
  } catch (err) {
    assertStringIncludes(err instanceof Error ? err.message : String(err), "Brak historii");
  }
});
