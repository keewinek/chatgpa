import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import MarkdownBody from "./MarkdownBody.tsx";
import {
  noteRelativePath,
  notesDelete,
  notesList,
  notesMkdir,
  notesRead,
  notesWrite,
} from "../lib/notes-api.ts";
import type { FsEntry } from "../lib/fs-api.ts";

interface NotesPanelProps {
  onBack: () => void;
  initialPath?: string | null;
  embedded?: boolean;
}

type TreeNode = {
  entry: FsEntry;
  children?: TreeNode[];
  expanded: boolean;
  loaded: boolean;
};

export default function NotesPanel({ onBack, initialPath, embedded = false }: NotesPanelProps) {
  const loading = useSignal(true);
  const error = useSignal<string | null>(null);
  const tree = useSignal<TreeNode[]>([]);
  const selectedPath = useSignal<string | null>(null);
  const editorContent = useSignal("");
  const savedContent = useSignal("");
  const editorLoading = useSignal(false);
  const saving = useSignal(false);
  const newNoteName = useSignal("");
  const newFolderName = useSignal("");
  const showNewNote = useSignal(false);
  const showNewFolder = useSignal(false);

  const dirty = () => editorContent.value !== savedContent.value;

  async function loadRoot() {
    loading.value = true;
    error.value = null;
    try {
      const result = await notesList();
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
    const rel = noteRelativePath(node.entry.path);
    const result = await notesList(rel || undefined);
    node.children = result.entries.map((entry) => ({
      entry,
      expanded: false,
      loaded: false,
    }));
    node.loaded = true;
    tree.value = [...tree.value];
  }

  async function expandToPath(targetPath: string) {
    const rel = noteRelativePath(targetPath);
    if (!rel) return;

    const parts = rel.split("/");
    const fileName = parts.pop();
    if (!fileName) return;

    let nodes = tree.value;
    for (const part of parts) {
      let node = nodes.find((n) => n.entry.name === part && n.entry.kind === "directory");
      if (!node) {
        await loadRoot();
        nodes = tree.value;
        node = nodes.find((n) => n.entry.name === part && n.entry.kind === "directory");
      }
      if (!node) return;
      if (!node.loaded) await loadChildren(node);
      node.expanded = true;
      nodes = node.children ?? [];
    }
    tree.value = [...tree.value];

    const fileNode = nodes.find((n) =>
      n.entry.kind === "file" &&
      (n.entry.name === fileName ||
        n.entry.name === `${fileName}.md` ||
        n.entry.name.replace(/\.md$/, "") === fileName.replace(/\.md$/, ""))
    );
    if (fileNode?.entry.kind === "file") {
      await openNote(fileNode.entry.path);
    }
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

  async function openNote(path: string) {
    selectedPath.value = path;
    editorLoading.value = true;
    editorContent.value = "";
    savedContent.value = "";
    try {
      const file = await notesRead(noteRelativePath(path));
      editorContent.value = file.content;
      savedContent.value = file.content;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      editorContent.value = "";
      savedContent.value = "";
    } finally {
      editorLoading.value = false;
    }
  }

  async function onEntryClick(node: TreeNode) {
    if (node.entry.kind === "directory") {
      await toggleDir(node);
    } else {
      if (dirty()) {
        const ok = globalThis.confirm("Masz niezapisane zmiany. Otworzyć inną notatkę?");
        if (!ok) return;
      }
      await openNote(node.entry.path);
    }
  }

  async function handleSave() {
    if (!selectedPath.value || saving.value) return;
    saving.value = true;
    error.value = null;
    try {
      const rel = noteRelativePath(selectedPath.value);
      const result = await notesWrite(rel, editorContent.value);
      selectedPath.value = result.path;
      savedContent.value = editorContent.value;
      await loadRoot();
      if (initialPath) await expandToPath(result.path);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      saving.value = false;
    }
  }

  async function handleNewNote(e: Event) {
    e.preventDefault();
    const name = newNoteName.value.trim();
    if (!name) return;
    const rel = name.endsWith(".md") ? name : `${name}.md`;
    const template = `---\ntitle: ${name.replace(/\.md$/, "")}\ncreatedAt: ${
      new Date().toISOString().slice(0, 10)
    }\n---\n\n# ${name.replace(/\.md$/, "")}\n\n`;
    try {
      const result = await notesWrite(rel, template);
      newNoteName.value = "";
      showNewNote.value = false;
      await loadRoot();
      await expandToPath(result.path);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleNewFolder(e: Event) {
    e.preventDefault();
    const name = newFolderName.value.trim();
    if (!name) return;
    try {
      await notesMkdir(name);
      newFolderName.value = "";
      showNewFolder.value = false;
      await loadRoot();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleDelete() {
    if (!selectedPath.value) return;
    const rel = noteRelativePath(selectedPath.value);
    if (!globalThis.confirm(`Usunąć notatkę ${rel}?`)) return;
    try {
      await notesDelete(rel);
      selectedPath.value = null;
      editorContent.value = "";
      savedContent.value = "";
      await loadRoot();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  useEffect(() => {
    void loadRoot().then(() => {
      if (initialPath) void expandToPath(initialPath);
    });
  }, []);

  return (
    <div class={`notes-panel${embedded ? " notes-panel--embedded" : ""}`}>
      <header class="notes-header">
        {!embedded && (
          <button type="button" class="notes-back" onClick={onBack}>
            ← Czat
          </button>
        )}
        <div class="notes-header-text">
          <h1 class="notes-title">Notatki</h1>
          <p class="notes-subtitle">~/notes/</p>
        </div>
        <div class="notes-header-actions">
          <button
            type="button"
            class="notes-action"
            onClick={() => {
              showNewFolder.value = !showNewFolder.value;
              showNewNote.value = false;
            }}
          >
            + Katalog
          </button>
          <button
            type="button"
            class="notes-action"
            onClick={() => {
              showNewNote.value = !showNewNote.value;
              showNewFolder.value = false;
            }}
          >
            + Notatka
          </button>
          <button
            type="button"
            class="notes-refresh"
            onClick={() => void loadRoot()}
            title="Odśwież"
          >
            ↻
          </button>
        </div>
      </header>

      {error.value && <p class="notes-error">{error.value}</p>}

      {showNewNote.value && (
        <form class="notes-inline-form" onSubmit={(e) => void handleNewNote(e)}>
          <input
            type="text"
            class="notes-inline-input"
            placeholder="np. chemia/kwasy lub inbox"
            value={newNoteName.value}
            onInput={(e) => {
              newNoteName.value = (e.target as HTMLInputElement).value;
            }}
          />
          <button type="submit" class="notes-inline-btn">Utwórz</button>
        </form>
      )}

      {showNewFolder.value && (
        <form
          class="notes-inline-form"
          onSubmit={(e) => void handleNewFolder(e)}
        >
          <input
            type="text"
            class="notes-inline-input"
            placeholder="np. matma"
            value={newFolderName.value}
            onInput={(e) => {
              newFolderName.value = (e.target as HTMLInputElement).value;
            }}
          />
          <button type="submit" class="notes-inline-btn">Utwórz</button>
        </form>
      )}

      <div class="notes-body">
        <aside class="notes-tree" aria-label="Drzewo notatek">
          {loading.value && <p class="notes-muted">Ładowanie…</p>}
          {!loading.value && (
            <ul class="notes-tree-root">
              <li>
                <button
                  type="button"
                  class={`notes-tree-item${!selectedPath.value ? " notes-tree-item--active" : ""}`}
                  onClick={() => {
                    selectedPath.value = null;
                    editorContent.value = "";
                    savedContent.value = "";
                  }}
                >
                  <span class="notes-tree-icon">📝</span>
                  <span>notes/</span>
                </button>
                <ul class="notes-tree-children">
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

        <section class="notes-editor" aria-label="Edytor notatki">
          {selectedPath.value
            ? (
              <>
                <div class="notes-editor-head">
                  <span class="notes-editor-path">{selectedPath.value}</span>
                  <div class="notes-editor-actions">
                    {dirty() && <span class="notes-dirty">Niezapisane</span>}
                    <button
                      type="button"
                      class="notes-save"
                      disabled={saving.value || !dirty()}
                      onClick={() => void handleSave()}
                    >
                      {saving.value ? "Zapisuję…" : "Zapisz"}
                    </button>
                    <button
                      type="button"
                      class="notes-delete"
                      onClick={() => void handleDelete()}
                    >
                      Usuń
                    </button>
                  </div>
                </div>
                {editorLoading.value
                  ? <p class="notes-muted">Wczytywanie…</p>
                  : (
                    <div class="notes-split">
                      <textarea
                        class="notes-textarea"
                        value={editorContent.value}
                        spellcheck
                        onInput={(e) => {
                          editorContent.value = (e.target as HTMLTextAreaElement).value;
                        }}
                        placeholder="Pisz w Markdown…"
                      />
                      <div class="notes-preview">
                        <MarkdownBody
                          content={editorContent.value || "*Podgląd pojawi się tutaj.*"}
                        />
                      </div>
                    </div>
                  )}
              </>
            )
            : (
              <div class="notes-empty">
                <p>Wybierz notatkę z listy lub utwórz nową.</p>
                <p class="notes-muted">Agent może zapisywać notatki narzędziem notes.write.</p>
              </div>
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
        class={`notes-tree-item${active ? " notes-tree-item--active" : ""}`}
        style={{ paddingLeft: `${0.5 + depth * 0.85}rem` }}
        onClick={() => onClick(node)}
      >
        <span class="notes-tree-icon">
          {isDir ? (node.expanded ? "📂" : "📁") : "📄"}
        </span>
        <span>{node.entry.name}</span>
      </button>
      {isDir && node.expanded && node.children && (
        <ul class="notes-tree-children">
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
