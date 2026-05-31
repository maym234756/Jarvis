import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";

test("tool search ranks relevant backend tools", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `tool-search-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore });

  const matches = toolRegistry.searchTools("run a shell command", { limit: 5 });
  assert.equal(matches[0].name, "shell.run");

  const result = await toolRegistry.execute("tool.search", { query: "search memory", limit: 5 }, { projectRoot: root });
  assert.equal(result.ok, true);
  assert.ok(result.tools.some((tool) => tool.name === "memory.query"));
});
