# Working agreement

This repo is two things at once: the ChatGPA codebase, and — via the `chatgpa-fs` MCP server
(`.mcp.json`) — live access to the owner's real school data (TODO, calendar, grades, memory,
plans under `~/`). When the user asks something about their own school life (homework, what's
due, deadlines, grades, "what should I do today") rather than asking you to change code, that is
NOT off-topic for this project — it IS the project. Use `fs_read`/`fs_list`/`fs_grep` first
(`~/todo/global.todo`, `~/calendar/YYYY-MM.cal`, `~/school/librus/*.json`, `~/memory/long-term
.memory`) to ground your answer in their actual data before answering generically. Only treat a
request as unrelated if it truly has nothing to do with the user's school life or this app.

After completing and verifying any change in this project, create a focused Git
commit and push the current branch to its configured remote.

- Include only files changed for the current request; do not include unrelated
  working-tree changes.
- Run relevant verification before committing when practical.
- Report the commit hash and push result to the user.
