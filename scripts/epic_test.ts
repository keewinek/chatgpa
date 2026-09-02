import { assertEquals } from "@std/assert";
import { join } from "@std/path";

const ROOT = join(import.meta.dirname!, "..");

Deno.test("epic regen creates aktualny-prompt.md", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(ROOT, "scripts/epic.ts"), "regen"],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  const err = new TextDecoder().decode(stderr);
  assertEquals(code, 0, err);

  const prompt = await Deno.readTextFile(join(ROOT, "ai-kontekst/aktualny-prompt.md"));
  const hasActivePrompt = prompt.includes("Prompt ") && prompt.includes("deno task epic:done");
  const allComplete = prompt.includes("ukończone");
  assertEquals(hasActivePrompt || allComplete, true);

  const plan = await Deno.readTextFile(join(ROOT, "ai-kontekst/plan-implementacji.md"));
  assertEquals(plan.includes("<!-- EPIC_AUTO_START -->"), true);
  assertEquals(plan.includes("aktualny-prompt.md"), true);
});
