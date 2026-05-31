import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";

test("tool registry queues and resolves approval-gated API actions", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `approval-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(root, { recursive: true });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const registry = createDefaultToolRegistry({ projectRoot: root, memoryStore });
  const pending = await registry.execute("search.web", { query: "jarvis test" }, { projectRoot: root });

  assert.equal(pending.pendingApproval, true);
  assert.ok(pending.approvalId);

  const approvals = await registry.approvalQueue.list({ status: "pending" });
  assert.equal(approvals.length, 1);

  const result = await registry.approve(pending.approvalId, { approved: true });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "none");
});
