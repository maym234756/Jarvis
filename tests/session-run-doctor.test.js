import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SessionStore } from "../packages/session/index.js";
import { RunStore } from "../packages/runs/index.js";
import { runDoctor } from "../packages/diagnostics/index.js";
import { MemoryStore } from "../packages/memory/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";

test("session store saves and lists messages", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `session-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const store = new SessionStore({ projectRoot: root });
  const session = await store.createSession({ title: "Test session" });
  await store.appendMessage(session.id, { role: "user", content: "hello" });

  const full = await store.getSession(session.id);
  const sessions = await store.listSessions();

  assert.equal(full.messages.length, 1);
  assert.equal(sessions[0].messages, 1);
  assert.equal(sessions[0].title, "Test session");
});

test("run store tracks run lifecycle", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `runs-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const store = new RunStore({ projectRoot: root });
  const run = await store.startRun({
    message: "hello",
    mode: "agent",
    privacyLevel: "project",
    taskType: "chat",
    workflow: { name: "GeneralChatWorkflow" }
  });
  await store.completeRun(run.id, { tool_count: 1 });

  const runs = await store.listRuns();
  const stats = await store.stats();

  assert.equal(runs[0].status, "completed");
  assert.equal(runs[0].tool_count, 1);
  assert.equal(stats.completed, 1);
});

test("doctor returns actionable diagnostics", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `doctor-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(root, { recursive: true });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore });
  const report = await runDoctor({ projectRoot: root, memoryStore, toolRegistry });

  assert.equal(report.ok, true);
  assert.ok(report.checks.some((item) => item.name === "Model provider"));
  assert.ok(report.checks.some((item) => item.name === "Tool registry"));
});
