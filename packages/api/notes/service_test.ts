import { assertEquals } from "@std/assert";
import { resolveNotesPath } from "./service.ts";

Deno.test("resolveNotesPath accepts relative paths", () => {
  const r = resolveNotesPath("chemia/kwasy");
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.virtual, "~/notes/chemia/kwasy");
});

Deno.test("resolveNotesPath accepts full ~/notes paths", () => {
  const r = resolveNotesPath("~/notes/inbox.md");
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.virtual, "~/notes/inbox.md");
});

Deno.test("resolveNotesPath rejects traversal", () => {
  const r = resolveNotesPath("../todo/global.todo");
  assertEquals(r.ok, false);
});
