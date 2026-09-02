import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { entryIcon, type FsEntry, fsList, fsRead } from "../lib/fs-api.ts";

interface FilesPanelProps {
  onBack: () => void;
}

type TreeNode = {
  entry: FsEntry;
  children?: TreeNode[];
  expanded: boolean;
  loaded: boolean;
};

export default function FilesPanel({ onBack }: FilesPanelProps) {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const tree = useSignal<TreeNode[]>([]);
  const selectedPath = useSignal<string | null>(null);
  const preview = useSignal<string>("");
  const previewLoading = useSignal(false);
  const previewMeta = useSignal<string>("");

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

  async function selectFile(path: string) {
    selectedPath.value = path;
    previewLoading.value = true;
    preview.value = "";
    previewMeta.value = "";
    try {
      const file = await fsRead(path);
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
      await selectFile(node.entry.path);
    }
  }

  useEffect(() => {
    void loadRoot();
  }, []);

  return (
    <div class="files-panel">
      <header class="files-header">
        <button type="button" class="files-back" onClick={onBack}>
          ← Czat
        </button>
        <div class="files-header-text">
          <h1 class="files-title">Pliki</h1>
          <p class="files-subtitle">Wirtualny system plików ~/</p>
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
                    selectedPath.value === "~" ? " files-tree-item--active" : ""
                  }`}
                  onClick={() => {
                    selectedPath.value = "~";
                    preview.value = "Wybierz plik z drzewa po lewej.";
                    previewMeta.value = "";
                  }}
                >
                  <span class="files-tree-icon">🏠</span>
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

        <section class="files-preview" aria-label="Podgląd pliku">
          {selectedPath.value && (
            <div class="files-preview-head">
              <span class="files-preview-path">{selectedPath.value}</span>
              {previewMeta.value && <span class="files-preview-meta">{previewMeta.value}</span>}
            </div>
          )}
          {previewLoading.value
            ? <p class="files-muted">Wczytywanie…</p>
            : (
              <pre class="files-preview-content">{preview.value || "Wybierz plik, aby zobaczyć podgląd."}</pre>
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
  const active = selectedPath === node.entry.path;

  return (
    <li>
      <button
        type="button"
        class={`files-tree-item${active ? " files-tree-item--active" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
        onClick={() => onClick(node)}
      >
        <span class="files-tree-icon">
          {isDir ? (node.expanded ? "📂" : "📁") : entryIcon(node.entry)}
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
