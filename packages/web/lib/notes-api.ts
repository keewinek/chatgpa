import type { FsEntry } from "./fs-api.ts";

export type NotesListResponse = {
  path: string;
  entries: FsEntry[];
};

export type NotesReadResponse = {
  path: string;
  kind: "file";
  content: string;
  mimeType: string | null;
  totalLines: number;
  offset: number;
  limit: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export async function notesList(path?: string): Promise<NotesListResponse> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await fetch(`/api/notes${q}`);
  return parseJson<NotesListResponse>(res);
}

export async function notesRead(path: string): Promise<NotesReadResponse> {
  const res = await fetch(`/api/notes/file?path=${encodeURIComponent(path)}`);
  return parseJson<NotesReadResponse>(res);
}

export async function notesWrite(
  path: string,
  content: string,
): Promise<{ path: string; created: boolean }> {
  const res = await fetch("/api/notes/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  return parseJson(res);
}

export async function notesMkdir(path: string): Promise<{ path: string }> {
  const res = await fetch("/api/notes/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  return parseJson(res);
}

export async function notesDelete(path: string): Promise<{ path: string }> {
  const res = await fetch(`/api/notes/file?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  return parseJson(res);
}

/** Strip ~/notes/ prefix for display in the tree. */
export function noteRelativePath(fullPath: string): string {
  if (fullPath === "~/notes") return "";
  const prefix = "~/notes/";
  return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath;
}
