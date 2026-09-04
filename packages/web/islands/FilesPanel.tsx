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
import ResizablePanels from "./ResizablePanels.tsx";
import Icon from "./Icon.tsx";

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

function shortcutIconForName(name: string): string | null {
  const def = UI_SHORTCUTS.find((s) => s.file === name);
  return def?.icon ?? null;
}

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
  const treeOpen = useSignal(true);

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
      treeOpen.value = false;
      return;
    }
    selectedPath.value = path;
    activeUi.value = { view, title, path };
    preview.value = "";
    previewMeta.value = "";
    treeOpen.value = false;
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
      treeOpen.value = true;
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
      if (loading.value || tree.value.length === 0) await loadRoot();
      await openUiByView(view);
      onInitialUiConsumed?.();
    })();
  }, [initialUi]);

  function closeUi() {
    activeUi.value = null;
    preview.value = "";
    previewMeta.value = "";
    treeOpen.value = true;
  }

  const ui = activeUi.value;
  const treeCollapsed = !treeOpen.value;

  const treePane = (
    <aside class="files-tree" aria-label="Drzewo plików">
      {loading.value && <p class="files-muted">…</p>}
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
                preview.value = "";
                previewMeta.value = "";
              }}
            >
              <span class="files-tree-icon">
                <Icon name="house" />
              </span>
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
  );

  const previewPane = (
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
              : (
                <p class="files-empty-hint">
                  Otwórz dowolny plik — <code>.ui</code> pokazuje panel, reszta to podgląd
                </p>
              )}
          </>
        )}
    </section>
  );

  return (
    <div class={`files-panel${treeCollapsed ? " files-panel--tree-collapsed" : ""}`}>
      <header class="files-header">
        <button type="button" class="files-back" onClick={onBack} title="Czat" aria-label="Czat">
          <Icon name="arrow-left" />
        </button>
        <button
          type="button"
          class={`files-tree-toggle${treeOpen.value ? " files-tree-toggle--active" : ""}`}
          onClick={() => {
            treeOpen.value = !treeOpen.value;
          }}
          title={treeOpen.value ? "Ukryj listę plików" : "Pokaż listę plików"}
          aria-label={treeOpen.value ? "Ukryj listę plików" : "Pokaż listę plików"}
          aria-pressed={treeOpen.value}
        >
          <Icon name="folder-tree" />
        </button>
        <div class="files-header-spacer" />
        {ui && <span class="files-header-ui">{ui.title}</span>}
        <button
          type="button"
          class="files-refresh"
          onClick={() => void loadRoot()}
          title="Odśwież"
          aria-label="Odśwież"
        >
          <Icon name="arrows-rotate" />
        </button>
      </header>

      {error.value && <p class="files-error">{error.value}</p>}

      {!treeCollapsed && (
        <button
          type="button"
          class="files-tree-backdrop"
          aria-label="Zamknij listę plików"
          onClick={() => {
            treeOpen.value = false;
          }}
        />
      )}

      <ResizablePanels
        storageKey="files-tree"
        class="files-body"
        defaultSize={220}
        minSize={140}
        maxSize={420}
        collapsed={treeCollapsed}
        handleLabel="Zmień szerokość listy plików"
      >
        {treePane}
        {previewPane}
      </ResizablePanels>
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
  const uiIcon = isUi ? shortcutIconForName(node.entry.name) : null;

  return (
    <li>
      <button
        type="button"
        class={`files-tree-item${active ? " files-tree-item--active" : ""}${
          isUi ? " files-tree-item--ui" : ""
        }`}
        style={{ paddingLeft: `${0.45 + depth * 0.75}rem` }}
        onClick={() => onClick(node)}
      >
        <span class="files-tree-icon">
          {isDir
            ? (
              <Icon
                name={node.expanded ? "chevron-down" : "chevron-right"}
                class="files-tree-chevron"
              />
            )
            : <Icon name={uiIcon ?? (isUi ? "window-maximize" : entryIcon(node.entry))} />}
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
