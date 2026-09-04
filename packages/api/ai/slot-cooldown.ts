/** In-process cooldowns so tool rounds don't re-hit 429/404 models every time. */

const cooldownUntil = new Map<string, number>();

const COOLDOWN_QUOTA_MS = 10 * 60_000;
const COOLDOWN_GONE_MS = 24 * 60_000;

export function slotCooldownKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export function isSlotCoolingDown(provider: string, model: string, now = Date.now()): boolean {
  const until = cooldownUntil.get(slotCooldownKey(provider, model));
  return until !== undefined && until > now;
}

export function markSlotFailure(provider: string, model: string, error: string, now = Date.now()) {
  const key = slotCooldownKey(provider, model);
  const lower = error.toLowerCase();
  let ms = 0;
  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted")
  ) {
    ms = COOLDOWN_QUOTA_MS;
  } else if (
    lower.includes("404") ||
    lower.includes("no longer available") ||
    lower.includes("not found") ||
    lower.includes("deprecated")
  ) {
    ms = COOLDOWN_GONE_MS;
  }
  if (ms > 0) {
    const until = now + ms;
    const prev = cooldownUntil.get(key) ?? 0;
    if (until > prev) cooldownUntil.set(key, until);
  }
}

/** Test helper — clears all cooldowns. */
export function clearSlotCooldowns() {
  cooldownUntil.clear();
}
