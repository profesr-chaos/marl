# marl

Minimal project knowledge store for AI agents. Zero dependencies, plain Node, one file.

Agents record learnings as they work; future sessions prime them back into context. Knowledge lives in `.marl/knowledge.jsonl`, git-tracked with the project.

## Install

```bash
npm install -g github:profesr-chaos/marl
```

Or from a local clone: `npm link`.

## Usage

```bash
marl record db "Use WAL mode for SQLite" --type convention
marl record api "Retry on 429 with backoff" --type pattern --tags http
marl prime            # all knowledge, markdown — inject into agent context
marl prime db         # one domain
marl search sqlite    # find records
marl confirm a1b2c3   # "I applied this and it was right" — boosts survival
marl prune --days 90  # archive records nothing has touched in 90 days
```

Types: `convention`, `pattern`, `failure`, `decision`, `note`.

The feedback loop: `prime` and `confirm` stamp `last_used`; `prune` archives (never deletes — see `.marl/archive.jsonl`) whatever stops being touched. Knowledge that keeps getting used keeps living.

## Agent setup

Add to your project's `CLAUDE.md` / `AGENTS.md`:

> **marl** — this project's knowledge store. Follow this loop:
>
> 1. **Session start:** run `marl prime` and treat the output as project ground truth.
> 2. **Before recording:** run `marl search <keywords>` — if the fact already exists, `marl confirm <id>` instead of duplicating it.
> 3. **Before finishing a task:** record non-obvious learnings with `marl record <domain> "<text>" --type <type>`.
> 4. **When a primed record proves correct in practice:** run `marl confirm <id>`.
> 5. **When committing:** include `.marl/` in the same commit as the change that produced the learning.

### What to record

One fact per record, written so a stranger can act on it without context. Record things that are true next month and invisible in the code: gotchas with their resolution (`--type failure`), choices with their reason (`--type decision`), "always do X here" rules (`--type convention`), reusable approaches (`--type pattern`). Anything else is a `note`.

Do **not** record: anything derivable by reading the code, session-specific state ("tests currently failing"), secrets or credentials, or restatements of the task itself.

### Domains

Domains are just labels — short, stable, lowercase: `db`, `api`, `auth`, `build`, `deploy`. Reuse existing domains (`marl prime` shows them all) before inventing new ones.

### Output notes

`marl prime` emits plain markdown grouped by domain, safe to inject directly into context. All commands exit non-zero on error. Records are JSONL in `.marl/knowledge.jsonl` — human-readable, git-diffable, hand-editable if needed.
