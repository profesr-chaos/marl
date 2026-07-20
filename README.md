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

> Run `marl prime` at session start. Before finishing a task, record non-obvious learnings with `marl record <domain> "<text>" --type <type>`. When a primed record proves correct in practice, run `marl confirm <id>`.
