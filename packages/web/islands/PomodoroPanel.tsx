import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import Icon from "./Icon.tsx";

type PomodoroPhase = "work" | "break";

interface PomodoroPanelProps {
  onClose: () => void;
}

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const SOUND_KEY = "chatgpa-pomodoro-sound";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function loadSoundPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function saveSoundPref(enabled: boolean) {
  try {
    globalThis.localStorage?.setItem(SOUND_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
    void ctx.close();
  } catch {
    /* ignore — autoplay policy or missing API */
  }
}

export default function PomodoroPanel({ onClose }: PomodoroPanelProps) {
  const phase = useSignal<PomodoroPhase>("work");
  const remaining = useSignal(WORK_SECONDS);
  const running = useSignal(false);
  const soundEnabled = useSignal(loadSoundPref());

  useEffect(() => {
    if (!running.value) return;
    const id = setInterval(() => {
      if (remaining.value <= 1) {
        if (phase.value === "work") {
          phase.value = "break";
          remaining.value = BREAK_SECONDS;
        } else {
          phase.value = "work";
          remaining.value = WORK_SECONDS;
        }
        if (soundEnabled.value) playChime();
        return;
      }
      remaining.value -= 1;
    }, 1000);
    return () => clearInterval(id);
  }, [running.value]);

  function reset() {
    running.value = false;
    phase.value = "work";
    remaining.value = WORK_SECONDS;
  }

  function togglePhase(next: PomodoroPhase) {
    running.value = false;
    phase.value = next;
    remaining.value = next === "work" ? WORK_SECONDS : BREAK_SECONDS;
  }

  return (
    <div
      class="pomodoro-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Timer Pomodoro"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="pomodoro-panel">
        <header class="pomodoro-header">
          <h2 class="pomodoro-title">Pomodoro</h2>
          <button type="button" class="pomodoro-close" aria-label="Zamknij" onClick={onClose}>
            <Icon name="xmark" />
          </button>
        </header>

        <div class="pomodoro-phase-tabs">
          <button
            type="button"
            class={`pomodoro-phase-tab${
              phase.value === "work" ? " pomodoro-phase-tab--active" : ""
            }`}
            onClick={() => togglePhase("work")}
          >
            Nauka · 25 min
          </button>
          <button
            type="button"
            class={`pomodoro-phase-tab${
              phase.value === "break" ? " pomodoro-phase-tab--active" : ""
            }`}
            onClick={() => togglePhase("break")}
          >
            Przerwa · 5 min
          </button>
        </div>

        <p class="pomodoro-timer" aria-live="polite">
          {formatTime(remaining.value)}
        </p>
        <p class="pomodoro-label">
          {phase.value === "work" ? "Czas skupienia" : "Krótka przerwa"}
        </p>

        <div class="pomodoro-actions">
          <button
            type="button"
            class="pomodoro-btn pomodoro-btn--primary"
            onClick={() => {
              running.value = !running.value;
            }}
          >
            {running.value ? "Pauza" : "Start"}
          </button>
          <button type="button" class="pomodoro-btn" onClick={reset}>
            Reset
          </button>
        </div>

        <label class="pomodoro-sound">
          <input
            type="checkbox"
            checked={soundEnabled.value}
            onChange={(e) => {
              const enabled = (e.currentTarget as HTMLInputElement).checked;
              soundEnabled.value = enabled;
              saveSoundPref(enabled);
            }}
          />
          Dźwięk po zakończeniu fazy
        </label>
      </div>
    </div>
  );
}
