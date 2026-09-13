import { assertEquals } from "@std/assert";
import { withTestDb } from "../db/test-helpers.ts";
import { fsGrep, fsMkdir, fsWrite } from "./service.ts";

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
