import { assertEquals } from "@std/assert";
import { executeActions } from "./tools.ts";

Deno.test("memory.remember adds fact", () => {
  const memory: string[] = [];
  const { results, memory: updated } = executeActions(
    [{ tool: "memory.remember", args: { text: "Klasa 3A" } }],
    memory,
  );
  assertEquals(results[0].ok, true);
  assertEquals(updated, ["Klasa 3A"]);
});

Deno.test("calc.eval computes expression", () => {
  const { results } = executeActions(
    [{ tool: "calc.eval", args: { expression: "(2+3)*4" } }],
    [],
  );
  assertEquals(results[0].ok, true);
  assertEquals(results[0].output, "20");
});

Deno.test("memory.forget removes fact", () => {
  const { results, memory } = executeActions(
    [{ tool: "memory.forget", args: { text: "stary fakt" } }],
    ["Stary fakt", "Inny"],
  );
  assertEquals(results[0].ok, true);
  assertEquals(memory, ["Inny"]);
});

Deno.test("file.send stores downloadable file", () => {
  const { results } = executeActions(
    [{
      tool: "file.send",
      args: {
        name: "quiz.txt",
        content: "Pytanie 1: …",
        mimeType: "text/plain",
      },
    }],
    [],
  );
  assertEquals(results[0].ok, true);
  assertEquals(results[0].attachment?.name, "quiz.txt");
  assertEquals(results[0].attachment?.mimeType, "text/plain");
  assertEquals(results[0].output?.includes("/api/files/"), true);
});
