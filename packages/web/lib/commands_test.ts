import { assertEquals } from "@std/assert";
import { filterCommands, parseSlashCommand } from "./commands.ts";
import { PLAN_TODAY_SEED, PLAN_WEEK_SEED } from "./command-seeds.ts";

Deno.test("parseSlashCommand — /plan seed prompt na dziś", () => {
  const result = parseSlashCommand("/plan");
  assertEquals(result?.type, "prompt");
  if (result?.type === "prompt") {
    assertEquals(result.display, "/plan");
    assertEquals(result.seed, PLAN_TODAY_SEED);
  }
});

Deno.test("parseSlashCommand — /plan dziś alias", () => {
  const result = parseSlashCommand("/plan dziś");
  assertEquals(result?.type, "prompt");
  if (result?.type === "prompt") {
    assertEquals(result.display, "/plan");
    assertEquals(result.seed, PLAN_TODAY_SEED);
  }
});

Deno.test("parseSlashCommand — /plan tydzień seed prompt", () => {
  for (const cmd of ["/plan tydzień", "/plan tydzien", "  /plan tydzień  "]) {
    const result = parseSlashCommand(cmd);
    assertEquals(result?.type, "prompt");
    if (result?.type === "prompt") {
      assertEquals(result.display, "/plan tydzień");
      assertEquals(result.seed, PLAN_WEEK_SEED);
    }
  }
});

Deno.test("parseSlashCommand — /clear short memory", () => {
  const result = parseSlashCommand("/clear short memory");
  assertEquals(result, {
    type: "api",
    command: "clear-short-memory",
    confirmMessage: "Wyczyszczono krótką pamięć.",
  });
});

Deno.test("parseSlashCommand — komendy UI", () => {
  assertEquals(parseSlashCommand("/pomodoro"), { type: "ui", command: "pomodoro" });
  assertEquals(parseSlashCommand("/todo"), { type: "ui", command: "todo" });
  assertEquals(parseSlashCommand("/files"), { type: "ui", command: "files" });
  assertEquals(parseSlashCommand("/notes"), { type: "ui", command: "notes", notesPath: null });
});

Deno.test("parseSlashCommand — /notes otwórz ze ścieżką", () => {
  const result = parseSlashCommand("/notes otwórz chemia/kwasy.md");
  assertEquals(result, {
    type: "ui",
    command: "notes",
    notesPath: "chemia/kwasy.md",
  });
});

Deno.test("parseSlashCommand — nieznana komenda zwraca null", () => {
  assertEquals(parseSlashCommand("/quiz chemia"), null);
  assertEquals(parseSlashCommand("/plan coś dziwnego"), null);
  assertEquals(parseSlashCommand("/nieznana"), null);
});

Deno.test("parseSlashCommand — zwykła wiadomość bez slasha", () => {
  assertEquals(parseSlashCommand("cześć /plan"), null);
  assertEquals(parseSlashCommand("napisz plan na dziś"), null);
});

Deno.test("filterCommands — dopasowuje prefiks", () => {
  const matches = filterCommands("/pl");
  assertEquals(matches.length, 2);
  assertEquals(matches[0]?.trigger, "/plan");
  assertEquals(matches[1]?.trigger, "/plan tydzień");
});

Deno.test("filterCommands — pusty slash zwraca wszystkie", () => {
  assertEquals(filterCommands("/").length, 7);
});

Deno.test("filterCommands — bez slasha pusta lista", () => {
  assertEquals(filterCommands("plan"), []);
});
