import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { entryIcon, type FsEntry, fsList, fsRead } from "../lib/fs-api.ts";
import { isUiShortcut, parseUiShortcut, UI_SHORTCUTS, type UiView } from "../lib/ui-shortcuts.ts";
import CalendarPanel from "./CalendarPanel.tsx";
import TimetablePanel from "./TimetablePanel.tsx";
import TodoPanel from "./TodoPanel.tsx";
import NotesPanel from "./NotesPanel.tsx";
import ProfilePanel from "./ProfilePanel.tsx";

interface FilesPanelProps {
  onBack: () => void;
  initialUi?: UiView | null;
  onInitialUiConsumed?: () => void;
  onOpenPomodoro?: () => void;
  notesInitialPath?: string | null;
}

type TreeNode = {
  entry: FsEntry;
  children?: TreeNode[];
  expanded: boolean;
  loaded: boolean;
};

type ActiveUi = {
  view: UiView;
  title: string;
  path: string;
};

export default function FilesPanel({
  onBack,
  initialUi,
  onInitialUiConsumed,
  onOpenPomodoro,
  notesInitialPath,
}: FilesPanelProps) {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const tree = useSignal<TreeNode[]>([]);
  const selectedPath = useSignal<string | null>(null);
  const preview = useSignal<string>("");
  const previewLoading = useSignal(false);
  const previewMeta = useSignal<string>("");
  const activeUi = useSignal<ActiveUi | null>(null);

  async function loadRoot() {
    loading.value = true;
    error.value = null;
    try {
      const result = await fsList("~");
      tree.value = result.entries.map((entry) => ({
        entry,
        expanded: false,
        loaded: false,
      }));
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      tree.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadChildren(node: TreeNode) {
    if (node.entry.kind !== "directory") return;
    const result = await fsList(node.entry.path);
    node.children = result.entries.map((entry) => ({
      entry,
      expanded: false,
      loaded: false,
    }));
    node.loaded = true;
    tree.value = [...tree.value];
  }

  async function toggleDir(node: TreeNode) {
    if (node.entry.kind !== "directory") return;
    if (!node.expanded && !node.loaded) {
      try {
        await loadChildren(node);
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        return;
      }
    }
    node.expanded = !node.expanded;
    tree.value = [...tree.value];
  }

  async function expandPathTo(virtualPath: string) {
    const parts = virtualPath.replace(/^~\//, "").split("/").filter(Boolean);
    if (parts.length === 0) return;

    let nodes = tree.value;
    let prefix = "~";
    for (let i = 0; i < parts.length - 1; i++) {
      prefix = `${prefix}/${parts[i]}`;
      let node = nodes.find((n) => n.entry.path === prefix);
      if (!node) {
        await loadRoot();
        nodes = tree.value;
        node = nodes.find((n) => n.entry.path === prefix);
      }
      if (!node || node.entry.kind !== "directory") return;
      if (!node.loaded) await loadChildren(node);
      node.expanded = true;
      tree.value = [...tree.value];
      nodes = node.children ?? [];
    }
  }

  function openUi(view: UiView, title: string, path: string) {
    if (view === "pomodoro") {
      onOpenPomodoro?.();
      selectedPath.value = path;
      activeUi.value = null;
      preview.value = "Pomodoro otwarte w oknie nakładki.";
      previewMeta.value = "application/x-chatgpa-ui";
      return;
    }
    selectedPath.value = path;
    activeUi.value = { view, title, path };
    preview.value = "";
    previewMeta.value = "application/x-chatgpa-ui";
  }

  async function selectFile(path: string, name: string) {
    selectedPath.value = path;
    previewLoading.value = true;
    preview.value = "";
    previewMeta.value = "";
    activeUi.value = null;
    try {
      const file = await fsRead(path);
      if (isUiShortcut(name)) {
        const parsed = parseUiShortcut(path, file.content);
        if (parsed) {
          openUi(parsed.view, parsed.title, path);
          return;
        }
      }
      preview.value = file.content || "(pusty plik)";
      previewMeta.value = file.mimeType ?? "text/plain";
    } catch (err) {
      preview.value = err instanceof Error ? err.message : String(err);
    } finally {
      previewLoading.value = false;
    }
  }

  async function onEntryClick(node: TreeNode) {
    if (node.entry.kind === "directory") {
      await toggleDir(node);
    } else {
      await selectFile(node.entry.path, node.entry.name);
    }
  }

  async function openUiByView(view: UiView) {
    const def = UI_SHORTCUTS.find((s) => s.view === view);
    if (!def) return;
    const path = `~/${def.dir}/${def.file}`;
    await expandPathTo(path);
    openUi(view, def.title, path);
  }

  useEffect(() => {
    void loadRoot();
  }, []);

  useEffect(() => {
    if (!initialUi) return;
    const view = initialUi;
    void (async () => {
      if (loading.value || tree.value.length === 0) {
        await loadRoot();
      }
      await openUiByView(view);
      onInitialUiConsumed?.();
    })();
  }, [initialUi]);

  function closeUi() {
    activeUi.value = null;
    preview.value = "Wybierz skrót .ui lub plik z drzewa.";
    previewMeta.value = "";
  }

  const ui = activeUi.value;

  return (
    <div class="files-panel">
      <header class="files-header">
        <button type="button" class="files-back" onClick={onBack}>
          ← Czat
        </button>
        <div class="files-header-text">
          <h1 class="files-title">Pliki</h1>
          <p class="files-subtitle">
            Skróty <code class="files-code">.ui</code> otwierają aplikacje · dane w{" "}
            <code class="files-code">~/</code>
          </p>
        </div>
        <button type="button" class="files-refresh" onClick={() => void loadRoot()} title="Odśwież">
          ↻
        </button>
      </header>

      {error.value && <p class="files-error">{error.value}</p>}

      <div class="files-body">
        <aside class="files-tree" aria-label="Drzewo plików">
          {loading.value && <p class="files-muted">Ładowanie…</p>}
          {!loading.value && (
            <ul class="files-tree-root">
              <li>
                <button
                  type="button"
                  class={`files-tree-item${
                    selectedPath.value === "~" && !ui ? " files-tree-item--active" : ""
                  }`}
                  onClick={() => {
                    selectedPath.value = "~";
                    activeUi.value = null;
                    preview.value = "Wybierz skrót .ui (Kalendarz, TODO, …) lub plik.";
                    previewMeta.value = "";
                  }}
                >
                  <span class="files-tree-icon">⌂</span>
                  <span>~</span>
                </button>
                <ul class="files-tree-children">
                  {tree.value.map((node) => (
                    <TreeBranch
                      key={node.entry.path}
                      node={node}
                      selectedPath={selectedPath.value}
                      depth={0}
                      onClick={(n) => void onEntryClick(n)}
                    />
                  ))}
                </ul>
              </li>
            </ul>
          )}
        </aside>

        <section
          class={`files-preview${ui ? " files-preview--ui" : ""}`}
          aria-label={ui ? ui.title : "Podgląd pliku"}
        >
          {ui
            ? (
              <div class="files-ui-host">
                {ui.view === "calendar" && (
                  <CalendarPanel
                    embedded
                    onBack={closeUi}
                    onOpenProfile={() => void openUiByView("profile")}
                  />
                )}
                {ui.view === "timetable" && <TimetablePanel embedded onBack={closeUi} />}
                {ui.view === "todo" && <TodoPanel embedded onBack={closeUi} />}
                {ui.view === "notes" && (
                  <NotesPanel
                    embedded
                    initialPath={notesInitialPath}
                    onBack={closeUi}
                  />
                )}
                {ui.view === "profile" && <ProfilePanel embedded onBack={closeUi} />}
              </div>
            )
            : (
              <>
                {selectedPath.value && (
                  <div class="files-preview-head">
                    <span class="files-preview-path">{selectedPath.value}</span>
                    {previewMeta.value && (
                      <span class="files-preview-meta">{previewMeta.value}</span>
                    )}
                  </div>
                )}
                {previewLoading.value
                  ? <p class="files-muted">Wczytywanie…</p>
                  : (
                    <pre class="files-preview-content">
                      {preview.value ||
                        "Wybierz skrót .ui z folderu (np. Kalendarz/calendar.ui), aby otworzyć aplikację."}
                    </pre>
                  )}
              </>
            )}
        </section>
      </div>
    </div>
  );
}

function TreeBranch({
  node,
  selectedPath,
  depth,
  onClick,
}: {
  node: TreeNode;
  selectedPath: string | null;
  depth: number;
  onClick: (node: TreeNode) => void;
}) {
  const isDir = node.entry.kind === "directory";
  const isUi = !isDir && isUiShortcut(node.entry.name);
  const active = selectedPath === node.entry.path;

  return (
    <li>
      <button
        type="button"
        class={`files-tree-item${active ? " files-tree-item--active" : ""}${
          isUi ? " files-tree-item--ui" : ""
        }`}
        style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
        onClick={() => onClick(node)}
      >
        <span class="files-tree-icon">
          {isDir ? (node.expanded ? "▾" : "▸") : entryIcon(node.entry)}
        </span>
        <span>{node.entry.name}</span>
        {isUi && <span class="files-tree-ui-badge">UI</span>}
      </button>
      {isDir && node.expanded && node.children && (
        <ul class="files-tree-children">
          {node.children.map((child) => (
            <TreeBranch
              key={child.entry.path}
              node={child}
              selectedPath={selectedPath}
              depth={depth + 1}
              onClick={onClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
