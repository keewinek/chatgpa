/**
 * Bridge between Claude Code (this repo) and ChatGPA's virtual FS (Postgres `file_nodes`).
 * Same DB, same paths (`~/...`) the running app and the in-app agent see — lets Claude Code
 * read/edit them directly, e.g. the self-improvement prompt at ~/dev/dla-claude-code.md.
 *
 *   deno task fs list [path]                 — list a directory (default ~)
 *   deno task fs read <path>                 — print file content
 *   deno task fs write <path> <content>       — overwrite/create a file (content: "-" = read stdin)
 *   deno task fs grep <query> [path] [limit]  — full-text search
 *   deno task fs mkdir <path>
 *   deno task fs delete <path>
 *
 * Requires DATABASE_URL (repo-root .env, loaded automatically).
 */
import { loadEnv } from "../packages/api/env.ts";
import { closeDb, getDb } from "../packages/api/db/client.ts";
import { fsDelete, fsGrep, fsList, fsMkdir, fsRead, fsWrite } from "../packages/api/fs/service.ts";

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Deno.stdin.readable) chunks.push(chunk);
  return new TextDecoder().decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function main(): Promise<void> {
  await loadEnv();
  const db = getDb();
  if (!db) {
    console.error("Brak DATABASE_URL — ustaw w .env żeby użyć scripts/fs-cli.ts");
    Deno.exit(1);
  }

  const [cmd, ...rest] = Deno.args;

  try {
    switch (cmd) {
      case "list": {
        const path = rest[0] ?? "~";
        const result = await fsList(db, path);
        if (result.entries.length === 0) {
          console.log(`${result.path}: (pusty katalog)`);
          break;
        }
        for (const e of result.entries) {
          console.log(`${e.kind === "directory" ? "[dir] " : "[file]"} ${e.name}  (${e.path})`);
        }
        break;
      }
      case "read": {
        const path = rest[0];
        if (!path) throw new Error("Użycie: fs read <path>");
        const result = await fsRead(db, path, 0, 100000);
        console.log(result.content);
        break;
      }
      case "write": {
        const path = rest[0];
        const rawContent = rest.slice(1).join(" ");
        if (!path) throw new Error("Użycie: fs write <path> <content|->");
        const content = rawContent === "-" || rawContent === "" ? await readStdin() : rawContent;
        const result = await fsWrite(db, path, content);
        console.log(result.created ? `Utworzono ${result.path}` : `Zaktualizowano ${result.path}`);
        break;
      }
      case "grep": {
        const query = rest[0];
        if (!query) throw new Error("Użycie: fs grep <query> [path] [limit]");
        const path = rest[1];
        const limit = rest[2] ? Number(rest[2]) : undefined;
        const result = await fsGrep(db, query, { path, limit });
        if (result.matches.length === 0) {
          console.log(`Brak wyników dla „${result.query}”.`);
          break;
        }
        for (const m of result.matches) {
          console.log(`${m.path}:${m.line}: ${m.snippet}`);
        }
        if (result.truncated) console.log("(więcej wyników — zawęź query albo path)");
        break;
      }
      case "mkdir": {
        const path = rest[0];
        if (!path) throw new Error("Użycie: fs mkdir <path>");
        const result = await fsMkdir(db, path);
        console.log(`Utworzono katalog ${result.path}`);
        break;
      }
      case "delete": {
        const path = rest[0];
        if (!path) throw new Error("Użycie: fs delete <path>");
        const result = await fsDelete(db, path);
        console.log(`Usunięto ${result.path}`);
        break;
      }
      default:
        console.error(
          "Nieznana komenda. Użyj: list | read | write | grep | mkdir | delete\n" +
            "Przykłady:\n" +
            "  deno task fs list ~\n" +
            "  deno task fs read ~/dev/dla-claude-code.md\n" +
            "  deno task fs grep kwasy",
        );
        Deno.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    Deno.exit(1);
  } finally {
    await closeDb();
  }
}

if (import.meta.main) {
  await main();
}
