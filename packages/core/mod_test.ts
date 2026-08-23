import { assertEquals } from "@std/assert";
import type { Subject } from "./types.ts";

Deno.test("Subject type shape", () => {
  const subject: Subject = {
    id: "math",
    name: "Matematyka",
    currentAverage: 4.2,
    targetAverage: 4.75,
  };
  assertEquals(subject.targetAverage, 4.75);
});
