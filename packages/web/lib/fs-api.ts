import { cachedGet, invalidateCache } from "./api-cache.ts";

export type FsEntry = {
  name: string;
  path: string;
  kind: "file" | "directory";
  mimeType?: string | null;
  size?: number;
  updatedAt?: string;
};

export type FsListResponse = {
  path: string;
  entries: FsEntry[];
};

export type FsReadResponse = {
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

export function fsList(path = "~"): Promise<FsListResponse> {
  return cachedGet(`fs:list:${path}`, async () => {
    const res = await fetch(`/api/fs?path=${encodeURIComponent(path)}`);
    return parseJson<FsListResponse>(res);
  });
}

export function fsRead(path: string): Promise<FsReadResponse> {
  return cachedGet(`fs:read:${path}`, async () => {
    const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`);
    return parseJson<FsReadResponse>(res);
  });
}

export async function fsWrite(
  path: string,
  content: string,
): Promise<{ path: string; created: boolean }> {
  const res = await fetch("/api/fs/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  const result = await parseJson<{ path: string; created: boolean }>(res);
  invalidateCache("fs:");
  if (path.includes("long-term.memory")) invalidateCache("memory:");
  return result;
}

export async function fsMkdir(path: string): Promise<{ path: string }> {
  const res = await fetch("/api/fs/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const result = await parseJson<{ path: string }>(res);
  invalidateCache("fs:");
  return result;
}

export async function fsDelete(path: string): Promise<{ path: string }> {
  const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  const result = await parseJson<{ path: string }>(res);
  invalidateCache("fs:");
  return result;
}

export function entryIcon(entry: FsEntry): string {
  if (entry.kind === "directory") return "folder";
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    md: "file-lines",
    todo: "list-check",
    memory: "brain",
    cal: "calendar",
    plan: "clipboard-list",
    profile: "user",
    ui: "window-maximize",
    json: "file-code",
    pdf: "file-pdf",
    txt: "file-lines",
    png: "file-image",
    jpg: "file-image",
    jpeg: "file-image",
    webp: "file-image",
    gif: "file-image",
  };
  return icons[ext] ?? "file";
}
