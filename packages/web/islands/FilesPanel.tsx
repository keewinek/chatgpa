import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { entryIcon, type FsEntry, fsList, fsRead } from "../lib/fs-api.ts";
import {
  isUiShortcut,
  parseUiShortcut,
  UI_SHORTCUTS,
  uiShortcutPath,
  type UiView,
} from "../lib/ui-shortcuts.ts";
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

const APP_DIRS = new Set(UI_SHORTCUTS.map((s) => s.dir));

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
  const showData = useSignal(false);

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
      preview.value = "";
      previewMeta.value = "";
      return;
    }
    selectedPath.value = path;
    activeUi.value = { view, title, path };
    preview.value = "";
    previewMeta.value = "";
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
      preview.value = file.content || "(pusty)";
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
    const path = uiShortcutPath(def);
    if (showData.value) await expandPathTo(path);
    openUi(view, def.title, path);
  }

  useEffect(() => {
    void loadRoot();
  }, []);

  useEffect(() => {
    if (!initialUi) return;
    const view = initialUi;
    void (async () => {
      if (loading.value || tree.value.length === 0) await loadRoot();
      await openUiByView(view);
      onInitialUiConsumed?.();
    })();
  }, [initialUi]);

  function closeUi() {
    activeUi.value = null;
    preview.value = "";
    previewMeta.value = "";
  }

  const ui = activeUi.value;
  const appNodes = tree.value.filter((n) => APP_DIRS.has(n.entry.name));
  const dataNodes = tree.value.filter((n) => !APP_DIRS.has(n.entry.name));

  return (
    <div class="files-panel">
      <header class="files-header">
        <button type="button" class="files-back" onClick={onBack} title="Czat">
          ←
        </button>
        <span class="files-header-label">~/</span>
        <div class="files-header-spacer" />
        <button
          type="button"
          class={`files-mode-btn${showData.value ? " files-mode-btn--active" : ""}`}
          onClick={() => {
            showData.value = !showData.value;
          }}
          title={showData.value ? "Tylko aplikacje" : "Pokaż dane"}
        >
          {showData.value ? "dane" : "apps"}
        </button>
        <button type="button" class="files-refresh" onClick={() => void loadRoot()} title="Odśwież">
          ↻
        </button>
      </header>

      {error.value && <p class="files-error">{error.value}</p>}

      <div class="files-body">
        <aside class="files-tree" aria-label="Drzewo plików">
          {loading.value && <p class="files-muted">…</p>}
          {!loading.value && !showData.value && (
            <ul class="files-tree-root files-apps">
              {UI_SHORTCUTS.map((def) => {
                const path = uiShortcutPath(def);
                const active = selectedPath.value === path || activeUi.value?.view === def.view;
                return (
                  <li key={def.view}>
                    <button
                      type="button"
                      class={`files-tree-item files-tree-item--app${
                        active ? " files-tree-item--active" : ""
                      }`}
                      onClick={() => void openUiByView(def.view)}
                    >
                      <span class="files-tree-icon">◇</span>
                      <span>{def.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading.value && showData.value && (
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
                    preview.value = "";
                    previewMeta.value = "";
                  }}
                >
                  <span class="files-tree-icon">~</span>
                  <span>home</span>
                </button>
                <ul class="files-tree-children">
                  {[...appNodes, ...dataNodes].map((node) => (
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
          aria-label={ui ? ui.title : "Podgląd"}
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
                {selectedPath.value && previewMeta.value && (
                  <div class="files-preview-head">
                    <span class="files-preview-path">{selectedPath.value}</span>
                  </div>
                )}
                {previewLoading.value
                  ? <p class="files-muted">…</p>
                  : preview.value
                  ? <pre class="files-preview-content">{preview.value}</pre>
                  : <p class="files-empty-hint">Wybierz aplikację</p>}
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
        style={{ paddingLeft: `${0.4 + depth * 0.7}rem` }}
        onClick={() => onClick(node)}
      >
        <span class="files-tree-icon">
          {isDir ? (node.expanded ? "▾" : "▸") : isUi ? "◇" : entryIcon(node.entry)}
        </span>
        <span>{node.entry.name}</span>
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
