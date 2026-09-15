/**
 * MCP server exposing ChatGPA's virtual FS (Postgres `file_nodes`) to Claude Code as live tools.
 * Same DB, same `~/…` paths the running app and the in-app agent see — this is the MCP upgrade of
 * the one-shot `scripts/fs-cli.ts` bridge (see ai-kontekst/system-plikow.md, "Samodoskonalenie").
 *
 * Registered for this repo in `.mcp.json`. Run standalone with `deno task mcp`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnv } from "../env.ts";
import { closeDb, getDb } from "../db/client.ts";
import { fsDelete, FsError, fsGrep, fsList, fsMkdir, fsRead, fsWrite } from "../fs/service.ts";

await loadEnv();
const db = getDb();
if (!db) {
  console.error("Brak DATABASE_URL — ustaw w .env żeby uruchomić packages/api/mcp/server.ts");
  Deno.exit(1);
}

const server = new McpServer({ name: "chatgpa-fs", version: "0.1.0" });

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function asError(err: unknown) {
  const message = err instanceof FsError
    ? err.message
    : err instanceof Error
    ? err.message
    : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

server.registerTool(
  "fs_list",
  {
    title: "List ChatGPA directory",
    description:
      "List a directory under ChatGPA's virtual ~/ filesystem (todo, notes, calendar, memory, plans, dev/…).",
    inputSchema: { path: z.string().default("~").describe('Virtual path, e.g. "~" or "~/todo"') },
  },
  async ({ path }) => {
    try {
      return text(await fsList(db, path));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_read",
  {
    title: "Read ChatGPA file",
    description: "Read a file's content from ChatGPA's virtual ~/ filesystem.",
    inputSchema: {
      path: z.string().describe('Virtual path, e.g. "~/todo/global.todo"'),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(2000).optional(),
    },
  },
  async ({ path, offset, limit }) => {
    try {
      return text(await fsRead(db, path, offset ?? 0, limit ?? 500));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_grep",
  {
    title: "Search ChatGPA files",
    description: "Full-text search across ChatGPA's virtual ~/ filesystem.",
    inputSchema: {
      query: z.string(),
      path: z.string().optional().describe("Scope search to this virtual path (default: ~)"),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  async ({ query, path, limit }) => {
    try {
      return text(await fsGrep(db, query, { path, limit }));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_write",
  {
    title: "Write ChatGPA file",
    description:
      "Create or overwrite a file in ChatGPA's virtual ~/ filesystem. Always fs_read first when " +
      "appending — this replaces the whole file content.",
    inputSchema: {
      path: z.string(),
      content: z.string(),
      createOnly: z.boolean().optional().describe("Fail instead of overwriting if the file exists"),
    },
  },
  async ({ path, content, createOnly }) => {
    try {
      return text(await fsWrite(db, path, content, createOnly ?? false));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_mkdir",
  {
    title: "Create ChatGPA directory",
    description: "Create a directory in ChatGPA's virtual ~/ filesystem.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    try {
      return text(await fsMkdir(db, path));
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "fs_delete",
  {
    title: "Delete ChatGPA file",
    description: "Delete a file or empty directory in ChatGPA's virtual ~/ filesystem.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    try {
      return text(await fsDelete(db, path));
    } catch (err) {
      return asError(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

globalThis.addEventListener("unload", () => {
  closeDb();
});
