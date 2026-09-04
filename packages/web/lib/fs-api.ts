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

export async function fsList(path = "~"): Promise<FsListResponse> {
  const res = await fetch(`/api/fs?path=${encodeURIComponent(path)}`);
  return parseJson<FsListResponse>(res);
}

export async function fsRead(path: string): Promise<FsReadResponse> {
  const res = await fetch(`/api/fs/file?path=${encodeURIComponent(path)}`);
  return parseJson<FsReadResponse>(res);
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
  return parseJson(res);
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
