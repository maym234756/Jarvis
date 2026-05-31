import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RepoIntelligence } from "../packages/repo-intelligence/index.js";

test("repo intelligence maps package scripts and exported symbols", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `repo-map-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(path.join(root, "src"), { recursive: true });
  await fs.promises.writeFile(path.join(root, "package.json"), JSON.stringify({
    name: "sample",
    scripts: { test: "node --test" }
  }), "utf8");
  await fs.promises.writeFile(path.join(root, "src", "index.js"), "export function hello() { return 'hi'; }\nexport class Worker {}", "utf8");

  const map = await new RepoIntelligence({ projectRoot: root }).buildMap();

  assert.equal(map.package.name, "sample");
  assert.ok(map.summary.scripts.includes("test"));
  assert.ok(map.symbols.some((symbol) => symbol.name === "hello"));
  assert.ok(map.symbols.some((symbol) => symbol.name === "Worker"));
});
