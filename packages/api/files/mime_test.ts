import { assertEquals } from "@std/assert";
import { isVisionMime, normalizeMimeType } from "./mime.ts";

Deno.test("normalizeMimeType infers from extension", () => {
  assertEquals(normalizeMimeType("", "notes.pdf"), "application/pdf");
  assertEquals(normalizeMimeType("", "photo.JPG"), "image/jpeg");
  assertEquals(
    normalizeMimeType("", "essay.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
});

Deno.test("isVisionMime detects images and pdf", () => {
  assertEquals(isVisionMime("image/png"), true);
  assertEquals(isVisionMime("application/pdf"), true);
  assertEquals(isVisionMime("text/plain"), false);
});
