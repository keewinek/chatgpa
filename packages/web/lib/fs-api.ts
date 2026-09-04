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
  if (entry.kind === "directory") return "📁";
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const icons: Record<string, string> = {
    md: "📝",
    todo: "✅",
    memory: "🧠",
    cal: "📅",
    plan: "📋",
    profile: "👤",
    ui: "◇",
    json: "📊",
    pdf: "📕",
  };
  return icons[ext] ?? "📄";
}
