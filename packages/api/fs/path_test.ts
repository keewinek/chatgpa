import { assertEquals } from "@std/assert";
import { resolveVirtualPath, toVirtualPath, USER_ROOT } from "./path.ts";

Deno.test("resolveVirtualPath maps ~ to user root", () => {
  const r = resolveVirtualPath("~");
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.internal, USER_ROOT);
    assertEquals(r.virtual, "~");
  }
});

Deno.test("resolveVirtualPath maps ~/memory/foo", () => {
  const r = resolveVirtualPath("~/memory/foo.md");
  assertEquals(r.ok, true);
  if (r.ok) {
    assertEquals(r.internal, `${USER_ROOT}/memory/foo.md`);
    assertEquals(r.virtual, "~/memory/foo.md");
  }
});

Deno.test("resolveVirtualPath rejects ..", () => {
  const r = resolveVirtualPath("~/notes/../etc/passwd");
  assertEquals(r.ok, false);
});

Deno.test("toVirtualPath converts internal path", () => {
  assertEquals(toVirtualPath(USER_ROOT), "~");
  assertEquals(toVirtualPath(`${USER_ROOT}/todo/global.todo`), "~/todo/global.todo");
});
