import type { MemoryEntry } from "@chatgpa/core";
import { cachedGet, invalidateCache } from "./api-cache.ts";

const API = "";

export function fetchMemory(kind?: "short" | "long"): Promise<MemoryEntry[]> {
  const key = `memory:${kind ?? "all"}`;
  return cachedGet(key, async () => {
    const params = kind ? `?kind=${kind}` : "";
    const res = await fetch(`${API}/api/memory${params}`);
    if (!res.ok) return [];
    const data = await res.json() as { entries?: MemoryEntry[] };
    return Array.isArray(data.entries) ? data.entries : [];
  });
}

export async function migrateLegacyMemory(facts: string[]): Promise<MemoryEntry[]> {
  if (!facts.length) return fetchMemory();
  const res = await fetch(`${API}/api/memory/migrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ facts }),
  });
  invalidateCache("memory:");
  if (!res.ok) return [];
  const data = await res.json() as { entries?: MemoryEntry[] };
  return Array.isArray(data.entries) ? data.entries : [];
}

export async function clearShortMemory(): Promise<MemoryEntry[]> {
  const res = await fetch(`${API}/api/memory?kind=short`, { method: "DELETE" });
  invalidateCache("memory:");
  if (!res.ok) return fetchMemory();
  const data = await res.json() as { entries?: MemoryEntry[] };
  return Array.isArray(data.entries) ? data.entries : [];
}

export async function clearAllMemory(): Promise<MemoryEntry[]> {
  const res = await fetch(`${API}/api/memory?kind=all`, { method: "DELETE" });
  invalidateCache("memory:");
  if (!res.ok) return fetchMemory();
  const data = await res.json() as { entries?: MemoryEntry[] };
  return Array.isArray(data.entries) ? data.entries : [];
}

export function formatExpiry(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
