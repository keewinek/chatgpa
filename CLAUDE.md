# Working agreement

This repo is two things at once: the ChatGPA codebase, and — via the `chatgpa-fs` MCP server
(`.mcp.json`, `packages/api/mcp/server.ts`) — live access to the owner's real school data (TODO,
calendar, grades, memory, timetable under `~/`). When the user asks something about their own
school life (homework, what's due, deadlines, grades, "what should I do today") rather than
asking you to change code, that is NOT off-topic for this project — it IS the project. Only treat
a request as unrelated if it truly has nothing to do with the user's school life or this app.

**Always know the schedule.** Call `timetable_now` (or `timetable_today`) early in any
school-related conversation, unprompted — don't wait to be asked "what lesson do I have now."

**Read before answering.** `todo_list`, `calendar_list`, `grades_get`, `memory_list` ground your
answer in real data — use them instead of guessing. `fs_grep`/`fs_list`/`fs_read` are the
general-purpose fallback for anything without a dedicated tool (notes, plans, dev channel).

**Capture, don't just read.** When the user mentions a real assignment, deadline, or task in
conversation ("mam pracę domową na poniedziałek", "jutro sprawdzian z...") — write it down with
`todo_add` and, if it has a real date, `calendar_add` (`kind: "homework"` or `"exam"`). Use these
tools, not `fs_write` to `~/todo/global.todo` / `~/calendar/YYYY-MM.cal` directly — they validate
fields (e.g. `kind` must be a real `EventKind`) and can't corrupt the file the way a hand-written
`fs_write` can; `todo_update`/`todo_complete`/`calendar_update` for edits. `memory_remember` for
durable facts about the student (preferences, goals, constraints) that should survive between
sessions. Confirm briefly what you saved ("zapisałem to w TODO na poniedziałek") so the user knows
it stuck.

These domain tools call this repo's own `todo/service.ts` / `calendar/service.ts` /
`memory/service.ts` — the same functions the deployed app and the in-app agent use — so writes
show up in the web app/PWA immediately, correctly formatted, no manual file surgery.

After completing and verifying any change in this project, create a focused Git
commit and push the current branch to its configured remote.

- Include only files changed for the current request; do not include unrelated
  working-tree changes.
- Run relevant verification before committing when practical.
- Report the commit hash and push result to the user.
