import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CLI = path.resolve(import.meta.dirname, "marl.js");
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "marl-test-"));

function marl(...args) {
  const res = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
  return { out: res.stdout + res.stderr, code: res.status };
}

test("record → prime → search → confirm → prune round trip", () => {
  let r = marl("record", "db", "Use WAL mode for SQLite", "--type", "convention");
  assert.equal(r.code, 0);
  const id = r.out.match(/\[(\w{6})\]/)[1];

  marl("record", "api", "Rate limit is 100/min", "--type", "note", "--tags", "limits");

  r = marl("prime");
  assert.match(r.out, /## db/);
  assert.match(r.out, /WAL mode/);
  assert.match(r.out, /#limits/);

  r = marl("prime", "db");
  assert.match(r.out, /WAL mode/);
  assert.doesNotMatch(r.out, /Rate limit/);

  r = marl("search", "sqlite", "wal");
  assert.match(r.out, /WAL mode/);
  assert.doesNotMatch(r.out, /Rate limit/);

  r = marl("confirm", id);
  assert.match(r.out, /×1/);

  r = marl("prune", "--days", "30", "--dry-run");
  assert.match(r.out, /Nothing stale/); // everything just touched

  // backdate one record, then prune for real
  const file = path.join(cwd, ".marl", "knowledge.jsonl");
  const records = fs.readFileSync(file, "utf8").trim().split("\n").map(JSON.parse);
  records[1].last_used = "2020-01-01T00:00:00.000Z";
  fs.writeFileSync(file, records.map((x) => JSON.stringify(x)).join("\n") + "\n");
  r = marl("prune", "--days", "30");
  assert.match(r.out, /archived api/);
  assert.doesNotMatch(marl("prime").out, /Rate limit/);
  assert.match(fs.readFileSync(path.join(cwd, ".marl", "archive.jsonl"), "utf8"), /Rate limit/);
});

test("errors exit non-zero", () => {
  assert.equal(marl("record", "db").code, 1);
  assert.equal(marl("record", "db", "x", "--type", "bogus").code, 1);
  assert.equal(marl("confirm", "nope00").code, 1);
  assert.equal(marl("frobnicate").code, 1);
});
