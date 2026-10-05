---
name: daily-log
description: Draft today's LOG.md entry from the day's commits and changes. Use at the end of each working day or when I say "write my log".
---

# Draft today's LOG.md entry

1. Run `git log --since=midnight --oneline` and `git diff --stat HEAD@{midnight}` (if available) to see today's work.
2. Ask me two short questions if not already clear: what broke or was hard today, and what
   they learned.
3. Append an entry to LOG.md in this format (do not edit earlier entries):

   ## Day N — YYYY-MM-DD
   - **Built:** (requirement IDs and features, from commits)
   - **Broke / fixed:** (from my answer)
   - **Learned:** (from my answer, in my words)
   - **AI use:** (what Claude Code did today, e.g. "drafted tests for FR-27; I reviewed and edited")
   - **Tomorrow:** (next items from the build plan)

4. Keep it short and honest. Never invent problems or learnings I didn't mention.
