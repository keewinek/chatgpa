import { assertEquals, assertRejects } from "@std/assert";
import { bytesToBase64, getFile, putFile, toAttachment } from "./store.ts";

Deno.test("putFile stores and retrieves bytes", async () => {
  const bytes = new TextEncoder().encode("hello");
  const stored = await putFile({ name: "test.txt", mimeType: "text/plain", bytes });
  const loaded = getFile(stored.id);
  assertEquals(loaded?.name, "test.txt");
  assertEquals(loaded?.mimeType, "text/plain");
  assertEquals(new TextDecoder().decode(loaded!.bytes), "hello");
  assertEquals(toAttachment(stored).size, 5);
});

Deno.test("putFile rejects unknown mime", async () => {
  await assertRejects(
    async () => {
      await putFile({
        name: "evil.exe",
        mimeType: "application/x-msdownload",
        bytes: new Uint8Array([1, 2, 3]),
      });
    },
    Error,
    "Nieobsługiwany typ pliku",
  );
});

Deno.test("bytesToBase64 encodes", () => {
  const encoded = bytesToBase64(new TextEncoder().encode("ab"));
  assertEquals(encoded, "YWI=");
});
