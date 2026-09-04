import { type ComponentChildren, toChildArray } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";

const NARROW_MQ = "(max-width: 768px)";

function loadSize(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(`split:${key}`);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function saveSize(key: string, value: number) {
  try {
    localStorage.setItem(`split:${key}`, String(Math.round(value)));
  } catch {
    /* ignore */
  }
}

export type ResizablePanelsProps = {
  storageKey: string;
  /** Initial primary panel width in px. */
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  /** Hide the primary panel (e.g. file tree after opening a .ui). */
  collapsed?: boolean;
  class?: string;
  handleLabel?: string;
  children: ComponentChildren;
};

/** Two-pane horizontal split with a draggable handle (disabled on narrow screens). */
export default function ResizablePanels({
  storageKey,
  defaultSize = 240,
  minSize = 160,
  maxSize = 480,
  collapsed = false,
  class: className,
  handleLabel = "Zmień szerokość panelu",
  children,
}: ResizablePanelsProps) {
  const size = useSignal(loadSize(storageKey, defaultSize));
  const dragging = useSignal(false);
  const narrow = useSignal(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = globalThis.matchMedia?.(NARROW_MQ);
    if (!mq) return;
    const apply = () => {
      narrow.value = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!dragging.value) return;

    const onMove = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const next = Math.min(maxSize, Math.max(minSize, e.clientX - rect.left));
      size.value = next;
    };
    const onUp = () => {
      dragging.value = false;
      saveSize(storageKey, size.value);
    };

    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp);
    globalThis.addEventListener("pointercancel", onUp);
    return () => {
      globalThis.removeEventListener("pointermove", onMove);
      globalThis.removeEventListener("pointerup", onUp);
      globalThis.removeEventListener("pointercancel", onUp);
    };
  }, [dragging.value, storageKey, minSize, maxSize]);

  const kids = toChildArray(children);
  const primary = kids[0] ?? null;
  const secondary = kids[1] ?? null;
  const canResize = !narrow.value && !collapsed;

  return (
    <div
      ref={rootRef}
      class={[
        "split-panels",
        collapsed ? "split-panels--collapsed" : "",
        narrow.value ? "split-panels--narrow" : "",
        dragging.value ? "split-panels--dragging" : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
      style={canResize ? { "--split-size": `${size.value}px` } : undefined}
    >
      <div class="split-panels__primary">{primary}</div>
      {canResize && (
        <button
          type="button"
          class="split-panels__handle"
          aria-label={handleLabel}
          title={handleLabel}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
            dragging.value = true;
          }}
        />
      )}
      <div class="split-panels__secondary">{secondary}</div>
    </div>
  );
}
