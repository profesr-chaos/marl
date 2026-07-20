#!/usr/bin/env node
// marl — minimal project knowledge store for AI agents. Zero dependencies.
// Records live in .marl/knowledge.jsonl, one JSON object per line.
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ponytail: cwd-only, no upward .marl search like git — add if running from subdirs ever hurts
const DIR = path.join(process.cwd(), ".marl");
const FILE = path.join(DIR, "knowledge.jsonl");
const ARCHIVE = path.join(DIR, "archive.jsonl");

const TYPES = ["convention", "pattern", "failure", "decision", "note"];

function load(file = FILE) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(JSON.parse);
}

function save(records, file = FILE) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""));
}

function append(records, file) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.appendFileSync(file, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

function fail(msg) {
  console.error(`marl: ${msg}`);
  process.exit(1);
}

function line(r) {
  const badge = r.confirms > 0 ? `, ×${r.confirms}` : "";
  const tags = r.tags?.length ? ` #${r.tags.join(" #")}` : "";
  return `- [${r.id}] (${r.type}${badge}) ${r.text}${tags}`;
}

const cmds = {
  record(args) {
    const { values, positionals } = parseArgs({
      args,
      options: { type: { type: "string", default: "note" }, tags: { type: "string" } },
      allowPositionals: true,
    });
    const [domain, ...text] = positionals;
    if (!domain || text.length === 0) fail("usage: marl record <domain> <text...> [--type t] [--tags a,b]");
    if (!TYPES.includes(values.type)) fail(`type must be one of: ${TYPES.join(", ")}`);
    const rec = {
      id: randomBytes(3).toString("hex"),
      domain,
      type: values.type,
      text: text.join(" "),
      tags: values.tags ? values.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      created: new Date().toISOString(),
      last_used: null,
      confirms: 0,
    };
    save([...load(), rec]);
    console.log(`recorded [${rec.id}] in ${domain}`);
  },

  prime(args) {
    const [domain] = args;
    let records = load();
    if (domain) records = records.filter((r) => r.domain === domain);
    if (records.length === 0) {
      console.log(domain ? `No knowledge for domain "${domain}".` : "No knowledge recorded yet. Use: marl record <domain> <text...>");
      return;
    }
    console.log("# Project knowledge (.marl)\n");
    const domains = [...new Set(records.map((r) => r.domain))].sort();
    for (const d of domains) {
      console.log(`## ${d}`);
      for (const r of records.filter((r) => r.domain === d)) console.log(line(r));
      console.log("");
    }
    // feedback loop: primed = used. Prune keeps whatever keeps getting primed/confirmed.
    const now = new Date().toISOString();
    const emitted = new Set(records.map((r) => r.id));
    save(load().map((r) => (emitted.has(r.id) ? { ...r, last_used: now } : r)));
  },

  search(args) {
    if (args.length === 0) fail("usage: marl search <query...>");
    const terms = args.join(" ").toLowerCase().split(/\s+/);
    // ponytail: term-count scoring, BM25 when corpus outgrows a screenful
    const hits = load()
      .map((r) => {
        const hay = `${r.domain} ${r.type} ${r.text} ${r.tags.join(" ")}`.toLowerCase();
        return { r, score: terms.filter((t) => hay.includes(t)).length };
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || b.r.confirms - a.r.confirms);
    if (hits.length === 0) {
      console.log("No matches.");
      return;
    }
    for (const h of hits) console.log(`${h.r.domain} ${line(h.r)}`);
  },

  confirm(args) {
    const [id] = args;
    if (!id) fail("usage: marl confirm <id>");
    const records = load();
    const rec = records.find((r) => r.id === id);
    if (!rec) fail(`no record with id "${id}"`);
    rec.confirms += 1;
    rec.last_used = new Date().toISOString();
    save(records);
    console.log(`confirmed [${rec.id}] (×${rec.confirms}) ${rec.text}`);
  },

  prune(args) {
    const { values } = parseArgs({
      args,
      options: { days: { type: "string", default: "90" }, "dry-run": { type: "boolean", default: false } },
    });
    const days = Number(values.days);
    if (!Number.isFinite(days) || days <= 0) fail("--days must be a positive number");
    const cutoff = Date.now() - days * 86400000;
    const records = load();
    const stale = records.filter((r) => new Date(r.last_used ?? r.created).getTime() < cutoff);
    if (stale.length === 0) {
      console.log("Nothing stale.");
      return;
    }
    for (const r of stale) console.log(`${values["dry-run"] ? "would archive" : "archived"} ${r.domain} ${line(r)}`);
    if (!values["dry-run"]) {
      const staleIds = new Set(stale.map((r) => r.id));
      append(stale.map((r) => ({ ...r, archived: new Date().toISOString() })), ARCHIVE);
      save(records.filter((r) => !staleIds.has(r.id)));
    }
  },
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !cmds[cmd]) {
  console.log(`marl — project knowledge for AI agents

usage:
  marl record <domain> <text...> [--type ${TYPES.join("|")}] [--tags a,b]
  marl prime [domain]        print knowledge (touches last_used)
  marl search <query...>     find records
  marl confirm <id>          mark a record as applied and correct
  marl prune [--days 90] [--dry-run]   archive records untouched for N days`);
  process.exit(cmd ? 1 : 0);
}
cmds[cmd](rest);
