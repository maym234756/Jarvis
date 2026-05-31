import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BackendEvalRunner } from "../packages/evals/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";
import { SearchEngine } from "../packages/search/index.js";

test("backend eval runner checks core runtime behavior", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `evals-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const searchEngine = new SearchEngine();
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore, searchEngine });
  const evalRunner = new BackendEvalRunner({ projectRoot: root, toolRegistry, memoryStore, searchEngine });
  const report = await evalRunner.run();

  assert.equal(report.ok, true);
  assert.ok(report.results.some((item) => item.id === "tool_search_finds_shell_runner"));
});
