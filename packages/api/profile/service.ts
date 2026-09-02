import type { AppDatabase } from "../db/client.ts";
import { fsRead, fsWrite } from "../fs/service.ts";
import { FsError } from "../fs/service.ts";
import {
  DEFAULT_TIME_PROFILE,
  parseProfile,
  serializeProfile,
  type TimeProfile,
} from "@chatgpa/core";

export const PROFILE_PATH = "~/profile/me.profile";

export async function getProfile(db: AppDatabase): Promise<TimeProfile> {
  try {
    const file = await fsRead(db, PROFILE_PATH);
    return parseProfile(file.content);
  } catch (err) {
    if (err instanceof FsError && err.status === 404) {
      await ensureDefaultProfile(db);
      return { ...DEFAULT_TIME_PROFILE };
    }
    throw err;
  }
}

export async function ensureDefaultProfile(db: AppDatabase): Promise<void> {
  try {
    await fsRead(db, PROFILE_PATH);
  } catch (err) {
    if (err instanceof FsError && err.status === 404) {
      await fsWrite(db, PROFILE_PATH, serializeProfile(DEFAULT_TIME_PROFILE), true);
      return;
    }
    throw err;
  }
}

export async function updateProfile(
  db: AppDatabase,
  patch: Partial<TimeProfile>,
): Promise<TimeProfile> {
  const current = await getProfile(db);
  const next: TimeProfile = { ...current, ...patch };
  await fsWrite(db, PROFILE_PATH, serializeProfile(next));
  return next;
}

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProfileError";
  }
}
