import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createAgent } from "../packages/agent-core/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";
import { WorkflowEngine } from "../packages/workflow-engine/index.js";
import { ModelRouter } from "../packages/model-router/index.js";
import { PreferenceStore } from "../packages/preferences/index.js";

test("agent runs explicit read intent through file tool", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `agent-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(root, { recursive: true });
  await fs.promises.writeFile(path.join(root, "note.txt"), "hello from jarvis", "utf8");

  const memoryStore = new MemoryStore({ projectRoot: root });
  const preferenceStore = new PreferenceStore({ projectRoot: root });
  await preferenceStore.set({ key: "answer.length", value: "concise" });
  const toolRegistry = createDefaultToolRegistry({ projectRoot: root, memoryStore });
  const agent = createAgent({
    projectRoot: root,
    modelRouter: new ModelRouter({ forceLocalDraft: true }),
    toolRegistry,
    memoryStore,
    workflowEngine: new WorkflowEngine(),
    preferenceStore
  });

  const response = await agent.handleMessage("read note.txt", { projectRoot: root, runtimeProfile: "deep" });
  assert.equal(response.toolResults.length, 1);
  assert.equal(response.toolResults[0].ok, true);
  assert.equal(response.toolResults[0].content, "hello from jarvis");
  assert.equal(response.reasoningFrame.answerContract.style, "direct");
  assert.equal(response.runtimeProfile.id, "deep");
  assert.equal(response.responseMode.id, "command");
  assert.equal(response.verificationReport.status, "ok");
  assert.equal(response.userPreferences["answer.length"], "concise");
  assert.ok(response.answer.includes("**Result**"));
  assert.ok(response.answer.includes("hello from jarvis"));
});

test("agent auto-runs read-only research for fresh public facts", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `agent-research-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  await fs.promises.mkdir(root, { recursive: true });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const toolRegistry = createDefaultToolRegistry({
    projectRoot: root,
    memoryStore,
    searchEngine: {
      async research() {
        return {
          summary: "fresh research complete",
          provider: "test",
          results: [],
          sources: [],
          citations: [],
          precision: { fetchedSources: 0 }
        };
      }
    }
  });
  const agent = createAgent({
    projectRoot: root,
    modelRouter: new ModelRouter({ forceLocalDraft: true }),
    toolRegistry,
    memoryStore,
    workflowEngine: new WorkflowEngine()
  });

  const response = await agent.handleMessage("Who is the President of the US?", { projectRoot: root });
  assert.equal(response.taskType, "research");
  assert.equal(response.toolResults.length, 1);
  assert.equal(response.toolResults[0].tool, "research.run");
  assert.equal(response.toolResults[0].ok, true);
  assert.equal(response.toolResults[0].pendingApproval, undefined);
});
