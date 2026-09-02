import type { FreeSlotsResult } from "@chatgpa/core";
import { runCascade } from "../ai/cascade.ts";
import type { ChatMessage } from "../ai/types.ts";
import type { AiPlanResponse, DailyPlanResult, DayStudyItem, ExamAlert } from "./types.ts";

const PLAN_SYSTEM = `Jesteś asystentem planowania nauki w ChatGPA.
Dostaniesz ustrukturyzowane dane (TODO, kalendarz, wolne sloty, alerty sprawdzianowe).
Napisz krótką, ciepłą wiadomość po polsku dla ucznia wracającego ze szkoły.
Nie wymyślaj zadań spoza listy. Zwróć WYŁĄCZNIE poprawny JSON:
{"message":"...","notes":["..."]}`;

export function buildPlanAiPrompt(input: {
  date: string;
  weekdayLabel: string;
  freeSlots: FreeSlotsResult;
  items: DayStudyItem[];
  examAlerts: ExamAlert[];
  blocks: DailyPlanResult["blocks"];
}): string {
  const lines = [
    `Data planu: ${input.date} (${input.weekdayLabel})`,
    `Budżet nauki: ~${input.freeSlots.freeMinutes} min (${input.freeSlots.studyWindowStart}–${input.freeSlots.studyWindowEnd})`,
    "",
    "Zadania na dziś:",
  ];

  if (!input.items.length) {
    lines.push("- (brak zaplanowanych zadań)");
  } else {
    for (const item of input.items) {
      const exam = item.daysUntilExam ? ` (sprawdzian za ${item.daysUntilExam} dni)` : "";
      lines.push(`- [${item.minutes} min] ${item.title}${exam}`);
    }
  }

  if (input.examAlerts.length) {
    lines.push("", "Alerty sprawdzianowe:");
    for (const alert of input.examAlerts) {
      lines.push(`- T-${alert.daysUntil}: ${alert.title}`);
    }
  }

  if (input.blocks.length) {
    lines.push("", "Bloki czasowe:");
    for (const block of input.blocks) {
      lines.push(`- ${block.start}–${block.end}: ${block.title}`);
    }
  }

  lines.push(
    "",
    "Napisz wiadomość jak pierwsza wiadomość w czacie: plan na dziś, budżet minut, lista zadań, zachęta do negocjacji jeśli coś nie pasuje.",
  );

  return lines.join("\n");
}

export function buildFallbackMessage(
  date: string,
  weekdayLabel: string,
  freeMinutes: number,
  items: DayStudyItem[],
): string {
  const taskLines = items.length
    ? items.map((item, i) => {
      const exam = item.daysUntilExam ? ` *(sprawdzian za ${item.daysUntilExam} dni)*` : "";
      return `${i + 1}. [${item.minutes} min] ${item.title}${exam}`;
    }).join("\n")
    : "1. Brak pilnych zadań — możesz powtórzyć materiał z ostatnich lekcji.";

  return `Cześć! Oto plan na **${weekdayLabel}, ${date}**.

Masz ok. **${freeMinutes} min** na naukę.

### Na dziś
${taskLines}

Jeśli coś Ci dziś nie pasuje (lekarz, zajęcia), napisz — przesunę na inny dzień.`;
}

function parseAiJson(content: string): AiPlanResponse | null {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as AiPlanResponse;
    if (typeof parsed.message !== "string" || !parsed.message.trim()) return null;
    return {
      message: parsed.message.trim(),
      notes: Array.isArray(parsed.notes)
        ? parsed.notes.filter((n): n is string => typeof n === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export async function generatePlanMessage(input: {
  date: string;
  weekdayLabel: string;
  freeSlots: FreeSlotsResult;
  items: DayStudyItem[];
  examAlerts: ExamAlert[];
  blocks: DailyPlanResult["blocks"];
}): Promise<{ message: string; notes: string[]; aiUsed: boolean }> {
  const fallback = buildFallbackMessage(
    input.date,
    input.weekdayLabel,
    input.freeSlots.freeMinutes,
    input.items,
  );

  const userContent = buildPlanAiPrompt(input);
  const messages: ChatMessage[] = [
    { role: "system", content: PLAN_SYSTEM },
    { role: "user", content: userContent },
  ];

  const result = await runCascade(messages, undefined, { skipSystemWrap: true });
  if (!result.ok) {
    return { message: fallback, notes: [], aiUsed: false };
  }

  const parsed = parseAiJson(result.content);
  if (!parsed) {
    return { message: fallback, notes: [], aiUsed: false };
  }

  return {
    message: parsed.message,
    notes: parsed.notes ?? [],
    aiUsed: true,
  };
}
