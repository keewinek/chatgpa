import { assertEquals } from "@std/assert";
import { DEFAULT_TIME_PROFILE, parseProfile, serializeProfile } from "@chatgpa/core";
import { setDbForTests } from "../db/client.ts";
import { withTestDb } from "../db/test-helpers.ts";
import { getProfile, updateProfile } from "./service.ts";

Deno.test("parseProfile uses defaults for missing fields", () => {
  const profile = parseProfile("commuteAfterSchoolMinutes: 45\n");
  assertEquals(profile.commuteAfterSchoolMinutes, 45);
  assertEquals(profile.studyEndPreferred, DEFAULT_TIME_PROFILE.studyEndPreferred);
});

Deno.test("serializeProfile roundtrips", () => {
  const content = serializeProfile(DEFAULT_TIME_PROFILE);
  const parsed = parseProfile(content);
  assertEquals(parsed.commuteAfterSchoolMinutes, 60);
  assertEquals(parsed.notificationAfterSchoolMinutes, 30);
  assertEquals(parsed.studyEndPreferred, "21:00");
});

withTestDb("getProfile creates default me.profile", async ({ db }) => {
  setDbForTests(db);
  try {
    const profile = await getProfile(db);
    assertEquals(profile.commuteAfterSchoolMinutes, 60);
    assertEquals(profile.studyEndHard, "21:30");

    const updated = await updateProfile(db, { commuteAfterSchoolMinutes: 50 });
    assertEquals(updated.commuteAfterSchoolMinutes, 50);
    assertEquals(updated.studyEndPreferred, "21:00");

    const again = await getProfile(db);
    assertEquals(again.commuteAfterSchoolMinutes, 50);
  } finally {
    setDbForTests(undefined);
  }
});
