# Working agreement

This repo is two things at once: the ChatGPA codebase, and — via the `chatgpa-fs` MCP server
(`.mcp.json`) — live access to the owner's real school data (TODO, calendar, grades, memory,
plans under `~/`). When the user asks something about their own school life (homework, what's
due, deadlines, grades, "what should I do today") rather than asking you to change code, that is
NOT off-topic for this project — it IS the project. Use `fs_read`/`fs_list`/`fs_grep` first
(`~/todo/global.todo`, `~/calendar/YYYY-MM.cal`, `~/school/librus/*.json`, `~/memory/long-term
.memory`) to ground your answer in their actual data before answering generically. Only treat a
request as unrelated if it truly has nothing to do with the user's school life or this app.

**Capture, don't just read.** When the user mentions a real assignment, deadline, or task in
conversation ("mam pracę domową na poniedziałek", "jutro sprawdzian z...") — write it down, don't
let it evaporate after you answer. `fs_read` the target file first (never guess its current
content), then `fs_write` the whole file back:
- `~/todo/global.todo` — append under `## Otwarte` as
  `- [ ] Tytuł — id: task-<epoch-ms>-<rand> — due: YYYY-MM-DD — subject: <przedmiot> — source: ai`
  (keep the file's `---\nupdatedAt: <iso>\n---` frontmatter and existing sections intact; only add
  a line, never reformat/drop others). If the file doesn't exist yet, `fs_list ~/todo` first — the
  app seeds it on first use, so read again rather than inventing the frontmatter from scratch.
- `~/calendar/YYYY-MM.cal` — the matching month's JSON file, shape `{"month":"YYYY-MM","events":
  CalEvent[]}` with `CalEvent = {id, title, kind: "exam"|"homework"|"study_block"|"personal",
  start (ISO datetime), end?, source: "librus"|"ai"|"manual", subject?}`. Only touch this when
  there's a real date — append one event to the array, keep every other event byte-for-byte, and
  make sure the result is valid JSON before writing (a broken file breaks the calendar for
  everyone). If the file doesn't exist for that month, create `{"month":"YYYY-MM","events":[...]}`
  fresh.
Confirm briefly what you saved ("zapisałem to w TODO na poniedziałek") so the user knows it stuck.

After completing and verifying any change in this project, create a focused Git
commit and push the current branch to its configured remote.

- Include only files changed for the current request; do not include unrelated
  working-tree changes.
- Run relevant verification before committing when practical.
- Report the commit hash and push result to the user.
