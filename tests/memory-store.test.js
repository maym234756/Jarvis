import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MemoryStore } from "../packages/memory/index.js";

test("memory store ingests and retrieves chunks", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `memory-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.promises.writeFile(path.join(root, "docs", "architecture.md"), "Jarvis uses a policy engine and audit logs.", "utf8");

  const store = new MemoryStore({ projectRoot: root });
  const result = await store.ingestPath("docs");
  const matches = await store.query("audit policy");
  const filtered = await store.query("audit policy", {
    filters: { extension: ".md" }
  });
  const stats = await store.stats();
  await store.query("policy");
  const cachedStats = await store.stats();
  const compact = await store.compact();

  assert.equal(result.files, 1);
  assert.equal(result.added, 1);
  assert.equal(matches.length, 1);
  assert.equal(filtered.length, 1);
  assert.equal(stats.chunks, 1);
  assert.equal(cachedStats.cache.loaded, true);
  assert.ok(cachedStats.cache.hits >= 1);
  assert.equal(compact.removed, 0);
  assert.ok(matches[0].citation.label.includes("architecture.md"));
  assert.ok(Array.isArray(matches[0].embedding));
  assert.equal(matches[0].metadata.source_path, "docs\\architecture.md".replace(/\\/g, path.sep));
});

test("memory store rebuilds index", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `memory-rebuild-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.promises.writeFile(path.join(root, "docs", "one.md"), "alpha memory", "utf8");

  const store = new MemoryStore({ projectRoot: root });
  const rebuild = await store.rebuildIndex("docs");
  const matches = await store.query("alpha");

  assert.equal(rebuild.files, 1);
  assert.equal(rebuild.chunks, 1);
  assert.equal(matches.length, 1);
});
