import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { TimeProfile } from "@chatgpa/core";
import { DEFAULT_TIME_PROFILE } from "@chatgpa/core";
import { fetchProfile, formatStudyExample, saveProfile } from "../lib/profile-api.ts";
import Icon from "./Icon.tsx";

interface ProfilePanelProps {
  onBack: () => void;
  embedded?: boolean;
}

export default function ProfilePanel({ onBack, embedded = false }: ProfilePanelProps) {
  const profile = useSignal<TimeProfile>({ ...DEFAULT_TIME_PROFILE });
  const loading = useSignal(true);
  const saving = useSignal(false);
  const error = useSignal<string | null>(null);
  const saved = useSignal(false);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      profile.value = await fetchProfile();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    saving.value = true;
    error.value = null;
    saved.value = false;
    try {
      profile.value = await saveProfile(profile.value);
      saved.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      saving.value = false;
    }
  }

  function setField<K extends keyof TimeProfile>(key: K, value: TimeProfile[K]) {
    profile.value = { ...profile.value, [key]: value };
    saved.value = false;
  }

  return (
    <div class={`profile-panel${embedded ? " profile-panel--embedded" : ""}`}>
      <header class="profile-header">
        {!embedded && (
          <button type="button" class="profile-back" onClick={onBack}>
            <Icon name="arrow-left" /> Czat
          </button>
        )}
        <div class="profile-header-text">
          <h2 class="profile-title">Profil czasu</h2>
          <p class="profile-subtitle">~/profile/me.profile</p>
        </div>
      </header>

      {loading.value && <p class="profile-loading">Ładowanie…</p>}
      {error.value && <p class="profile-error">{error.value}</p>}

      {!loading.value && (
        <form class="profile-form" onSubmit={(e) => void handleSubmit(e)}>
          <p class="profile-hint">{formatStudyExample(profile.value)}</p>

          <label class="profile-field">
            <span class="profile-label">Powrót do domu po lekcjach (min)</span>
            <input
              type="number"
              min={0}
              max={180}
              value={profile.value.commuteAfterSchoolMinutes}
              onInput={(e) =>
                setField("commuteAfterSchoolMinutes", Number((e.target as HTMLInputElement).value))}
            />
          </label>

          <label class="profile-field">
            <span class="profile-label">Bufor (obiad itp., min)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={profile.value.commuteExtraMinutes}
              onInput={(e) =>
                setField("commuteExtraMinutes", Number((e.target as HTMLInputElement).value))}
            />
          </label>

          <label class="profile-field">
            <span class="profile-label">Prysznic / przerwa przed nauką (min)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={profile.value.showerAndBreakMinutes}
              onInput={(e) =>
                setField("showerAndBreakMinutes", Number((e.target as HTMLInputElement).value))}
            />
          </label>

          <label class="profile-field">
            <span class="profile-label">Preferowany koniec nauki</span>
            <input
              type="time"
              value={profile.value.studyEndPreferred}
              onInput={(e) => setField("studyEndPreferred", (e.target as HTMLInputElement).value)}
            />
          </label>

          <label class="profile-field">
            <span class="profile-label">Absolutne maximum nauki</span>
            <input
              type="time"
              value={profile.value.studyEndHard}
              onInput={(e) => setField("studyEndHard", (e.target as HTMLInputElement).value)}
            />
          </label>

          <label class="profile-field">
            <span class="profile-label">Powiadomienie po ostatniej lekcji (+min)</span>
            <input
              type="number"
              min={0}
              max={120}
              value={profile.value.notificationAfterSchoolMinutes}
              onInput={(e) =>
                setField(
                  "notificationAfterSchoolMinutes",
                  Number((e.target as HTMLInputElement).value),
                )}
            />
          </label>

          <div class="profile-actions">
            <button type="submit" class="profile-save" disabled={saving.value}>
              {saving.value ? "Zapisywanie…" : "Zapisz profil"}
            </button>
            {saved.value && <span class="profile-saved">Zapisano ✓</span>}
          </div>
        </form>
      )}
    </div>
  );
}
