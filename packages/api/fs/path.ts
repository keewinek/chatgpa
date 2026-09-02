/** Single-user virtual home — maps to ~/ in UI. */
export const USER_ID = "default";
export const USER_ROOT = `user/${USER_ID}`;

export type PathError = { ok: false; error: string };
export type PathOk = { ok: true; internal: string; virtual: string };

/** Normalize virtual path (~, /home) to internal DB path under user root. */
export function resolveVirtualPath(input: string): PathOk | PathError {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: true, internal: USER_ROOT, virtual: "~" };
  }

  let rest = trimmed;
  if (rest === "~" || rest === "/home" || rest === "/home/") {
    return { ok: true, internal: USER_ROOT, virtual: "~" };
  }
  if (rest.startsWith("~/")) rest = rest.slice(2);
  else if (rest.startsWith("/home/")) rest = rest.slice("/home/".length);
  else if (rest.startsWith("/")) rest = rest.slice(1);

  if (rest.includes("..")) {
    return { ok: false, error: "Ścieżka nie może zawierać .." };
  }

  const segments = rest.split("/").filter((s) => s.length > 0);
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      return { ok: false, error: "Nieprawidłowy segment ścieżki" };
    }
  }

  const internal = segments.length ? `${USER_ROOT}/${segments.join("/")}` : USER_ROOT;
  const virtual = segments.length ? `~/${segments.join("/")}` : "~";
  return { ok: true, internal, virtual };
}

/** Convert internal path back to virtual ~/ form. */
export function toVirtualPath(internal: string): string {
  if (internal === USER_ROOT) return "~";
  const prefix = `${USER_ROOT}/`;
  if (internal.startsWith(prefix)) {
    return `~/${internal.slice(prefix.length)}`;
  }
  return internal;
}

export function nodeIdForPath(internalPath: string): string {
  return `node:${internalPath}`;
}

export function guessMimeType(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  const map: Record<string, string> = {
    md: "text/markdown",
    todo: "text/markdown",
    memory: "text/plain",
    cal: "application/json",
    plan: "text/markdown",
    profile: "application/yaml",
    subject: "application/json",
    json: "application/json",
    txt: "text/plain",
    pdf: "application/pdf",
  };
  return map[ext] ?? null;
}
