/**
 * Zarządza kolejką epików ChatGPA — regeneruje aktualny prompt po każdym agencie.
 *
 *   deno task epic:status   — który epik jest teraz
 *   deno task epic:done     — oznacz bieżący jako ukończony, przesuń na następny
 *   deno task epic:regen    — przebuduj pliki bez przesuwania
 *   deno task epic:set -- 3 — ręcznie ustaw epik #3 (awaryjnie)
 */

import { dirname, fromFileUrl, join } from "@std/path";

const ROOT = join(dirname(dirname(fromFileUrl(import.meta.url))));
const EPICS_PATH = join(ROOT, "ai-kontekst/epics.json");
const STATE_PATH = join(ROOT, "ai-kontekst/epic-state.json");
const PROMPT_PATH = join(ROOT, "ai-kontekst/aktualny-prompt.md");
const PLAN_PATH = join(ROOT, "ai-kontekst/plan-implementacji.md");

const AUTO_START = "<!-- EPIC_AUTO_START -->";
const AUTO_END = "<!-- EPIC_AUTO_END -->";

const PROMPT_FOOTER = `
OBOWIĄZKOWE po zakończeniu epiku (w tej kolejności):
1. deno task test — musi przejść
2. Zaktualizuj ai-kontekst/roadmap.md (odhacz odpowiedni punkt)
3. deno task epic:done — automatycznie przesuwa następny prompt (NIE kończ sesji bez tego!)
4. (opcjonalnie) wpis w ai-kontekst/decyzje.md`;

interface Epic {
  id: number;
  title: string;
  phase: string;
  body: string;
}

interface EpicState {
  current: number | null;
  completed: number[];
  updatedAt: string;
}

interface EpicsFile {
  epics: Epic[];
}

async function loadEpics(): Promise<Epic[]> {
  const raw = await Deno.readTextFile(EPICS_PATH);
  const data = JSON.parse(raw) as EpicsFile;
  return data.epics.sort((a, b) => a.id - b.id);
}

async function loadState(): Promise<EpicState> {
  const raw = await Deno.readTextFile(STATE_PATH);
  return JSON.parse(raw) as EpicState;
}

async function saveState(state: EpicState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await Deno.writeTextFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function epicById(epics: Epic[], id: number): Epic | undefined {
  return epics.find((e) => e.id === id);
}

function queueStatus(epic: Epic, state: EpicState): string {
  if (state.completed.includes(epic.id)) return "✅";
  if (state.current === epic.id) return "⏳ **TERAZ**";
  return "⬜";
}

function buildPromptBlock(epic: Epic): string {
  return `${epic.body.trim()}${PROMPT_FOOTER}`;
}

function buildAktualnyPrompt(epics: Epic[], state: EpicState): string {
  if (state.current === null) {
    return `# Aktualny prompt — ✅ wszystko ukończone

Wszystkie ${epics.length} epików zostało oznaczonych jako ukończone.

Ukończone: ${state.completed.join(", ")}

Ostatnia aktualizacja: ${state.updatedAt}
`;
  }

  const epic = epicById(epics, state.current);
  if (!epic) {
    throw new Error(`Nieznany epik #${state.current}`);
  }

  const next = epicById(epics, state.current + 1);
  const nextLine = next
    ? `Prompt ${next.id} — ${next.title}`
    : "✅ koniec kolejki";

  return `# Aktualny prompt — skopiuj do nowego agenta

| | |
| --- | --- |
| **Epik** | Prompt ${epic.id} — ${epic.title} |
| **Faza** | ${epic.phase} |
| **Status** | ⏳ **DO ZROBIENIA** |
| **Następny po tym** | ${nextLine} |
| **Ostatnia aktualizacja** | ${state.updatedAt} |

> Skopiuj cały blok poniżej i wklej jako **pierwszą wiadomość** w nowym czacie agenta.

\`\`\`
${buildPromptBlock(epic)}
\`\`\`
`;
}

function buildPlanAutoSection(epics: Epic[], state: EpicState): string {
  const lines: string[] = [
    "## ▶ AKTUALNY PROMPT",
    "",
    "👉 **Skopiuj stąd:** [aktualny-prompt.md](./aktualny-prompt.md) — plik aktualizowany przez `deno task epic:done` po każdym agencie.",
    "",
  ];

  if (state.current === null) {
    lines.push("### ✅ Wszystkie epiki ukończone", "");
    lines.push(`Ukończone: ${state.completed.join(", ")}`, "");
  } else {
    const epic = epicById(epics, state.current)!;
    const next = epicById(epics, state.current + 1);
    lines.push(
      "| | |",
      "| --- | --- |",
      `| **Epik** | Prompt ${epic.id} — ${epic.title} |`,
      `| **Faza** | ${epic.phase} |`,
      `| **Status** | ⏳ **DO ZROBIENIA** |`,
      `| **Następny po tym** | ${
        next ? `Prompt ${next.id} — ${next.title}` : "✅ koniec kolejki"
      } |`,
      "",
      "> Otwórz **aktualny-prompt.md** i skopiuj blok \\`\\`\\` … \\`\\`\\`.",
      "",
      "### Po zakończeniu epiku (agent — obowiązkowo)",
      "",
      "1. `deno task test`",
      "2. `roadmap.md` — odhacz punkt",
      "3. **`deno task epic:done`** — przesuwa prompt (nie rób ręcznie!)",
      "",
    );
  }

  lines.push("## Kolejka promptów (auto)", "", "| # | Epik | Status |", "| --- | --- | --- |");
  for (const epic of epics) {
    lines.push(`| ${epic.id} | ${epic.title} | ${queueStatus(epic, state)} |`);
  }
  lines.push("");

  return lines.join("\n");
}

async function patchPlanSection(section: string): Promise<void> {
  const plan = await Deno.readTextFile(PLAN_PATH);
  const start = plan.indexOf(AUTO_START);
  const end = plan.indexOf(AUTO_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `Brak markerów ${AUTO_START} / ${AUTO_END} w plan-implementacji.md`,
    );
  }

  const updated =
    plan.slice(0, start + AUTO_START.length) +
    "\n\n" +
    section.trim() +
    "\n\n" +
    plan.slice(end);

  await Deno.writeTextFile(PLAN_PATH, updated);
}

async function regenerate(epics: Epic[], state: EpicState): Promise<void> {
  const promptMd = buildAktualnyPrompt(epics, state);
  const planSection = buildPlanAutoSection(epics, state);

  await Deno.writeTextFile(PROMPT_PATH, promptMd);
  await patchPlanSection(planSection);
}

async function cmdStatus(epics: Epic[], state: EpicState): Promise<void> {
  if (state.current === null) {
    console.log("✅ Wszystkie epiki ukończone.");
    console.log(`Ukończone: ${state.completed.join(", ")}`);
    return;
  }

  const epic = epicById(epics, state.current);
  if (!epic) {
    console.error(`Nieznany epik #${state.current}`);
    Deno.exit(1);
  }

  console.log(`⏳ Teraz: Prompt ${epic.id} — ${epic.title} (faza ${epic.phase})`);
  console.log(`✅ Ukończone: ${state.completed.length ? state.completed.join(", ") : "(brak)"}`);
  console.log(`📄 Skopiuj: ai-kontekst/aktualny-prompt.md`);
}

async function cmdDone(epics: Epic[], state: EpicState): Promise<void> {
  if (state.current === null) {
    console.log("Wszystkie epiki już ukończone — nic do przesunięcia.");
    return;
  }

  const currentId = state.current;
  const epic = epicById(epics, currentId);
  if (!epic) {
    throw new Error(`Nieznany epik #${currentId}`);
  }

  if (!state.completed.includes(currentId)) {
    state.completed.push(currentId);
    state.completed.sort((a, b) => a - b);
  }

  const maxId = epics[epics.length - 1]!.id;
  state.current = currentId < maxId ? currentId + 1 : null;

  await saveState(state);
  await regenerate(epics, state);

  if (state.current === null) {
    console.log(`✅ Epik ${currentId} (${epic.title}) ukończony.`);
    console.log("🎉 Wszystkie epiki w kolejce — aktualny-prompt.md zaktualizowany.");
  } else {
    const next = epicById(epics, state.current)!;
    console.log(`✅ Epik ${currentId} (${epic.title}) ukończony.`);
    console.log(`➡️  Następny: Prompt ${next.id} — ${next.title}`);
    console.log(`📄 Skopiuj: ai-kontekst/aktualny-prompt.md`);
  }
}

async function cmdSet(epics: Epic[], state: EpicState, id: number): Promise<void> {
  if (!epicById(epics, id)) {
    throw new Error(`Nie ma epiku #${id}`);
  }
  state.current = id;
  await saveState(state);
  await regenerate(epics, state);
  const epic = epicById(epics, id)!;
  console.log(`🔧 Ustawiono bieżący epik: Prompt ${id} — ${epic.title}`);
}

async function main(): Promise<void> {
  const epics = await loadEpics();
  const state = await loadState();
  const [cmd, arg] = Deno.args;

  switch (cmd ?? "status") {
    case "status":
      await cmdStatus(epics, state);
      break;
    case "done":
      await cmdDone(epics, state);
      break;
    case "regen":
      await regenerate(epics, state);
      console.log("🔄 Przebudowano aktualny-prompt.md i sekcję w plan-implementacji.md");
      break;
    case "set": {
      const id = Number(arg);
      if (!Number.isInteger(id) || id < 1) {
        console.error("Użycie: deno task epic:set -- <numer>");
        Deno.exit(1);
      }
      await cmdSet(epics, state, id);
      break;
    }
    default:
      console.error("Nieznana komenda. Użyj: status | done | regen | set <n>");
      Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
