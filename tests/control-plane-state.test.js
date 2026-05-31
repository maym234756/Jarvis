import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AIControlPlane } from "../packages/control-plane/index.js";
import { WorkflowEngine } from "../packages/workflow-engine/index.js";
import { ContextBudgetManager } from "../packages/context-budget/index.js";
import { ModelMesh } from "../packages/model-mesh/index.js";
import { CapabilityBus } from "../packages/capabilities/index.js";
import { PolicyStore } from "../packages/policy/index.js";
import { EventBus } from "../packages/events/index.js";
import { WorkflowStateStore } from "../packages/workflow-state/index.js";
import { ArtifactStore } from "../packages/artifacts/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";

test("control plane creates a structured decision from a user request", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `control-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const capabilityBus = new CapabilityBus();
  const toolRegistry = createDefaultToolRegistry({
    projectRoot: root,
    memoryStore: new MemoryStore({ projectRoot: root }),
    capabilityBus
  });
  capabilityBus.setToolRegistry(toolRegistry);
  const controlPlane = new AIControlPlane({
    workflowEngine: new WorkflowEngine(),
    modelMesh: new ModelMesh(),
    contextBudgetManager: new ContextBudgetManager(),
    capabilityBus,
    policyStore: new PolicyStore({ projectRoot: root })
  }).setToolRegistry(toolRegistry);

  const decision = await controlPlane.decide({ message: "fix failing tests", runtimeProfile: "deep" });

  assert.equal(decision.taskType, "coding");
  assert.equal(decision.workflow.name, "CodeChangeWorkflow");
  assert.equal(decision.modelRoute.primaryRole, "code-specialist");
  assert.ok(decision.contextBudget.total_context > 0);
});

test("events, workflow state, policy, and artifacts persist local records", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `state-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const eventBus = new EventBus({ projectRoot: root });
  const policyStore = new PolicyStore({ projectRoot: root });
  const workflowStateStore = new WorkflowStateStore({ projectRoot: root });
  const artifactStore = new ArtifactStore({ projectRoot: root });

  const streamed = [];
  const unsubscribe = eventBus.subscribe((event) => streamed.push(event));
  await eventBus.publish("test.event", { ok: true });
  unsubscribe();
  const policy = await policyStore.getPolicy();
  await workflowStateStore.create({ runId: "run-test", workflow: "TestWorkflow", goal: "test", taskType: "chat" });
  await workflowStateStore.transition("run-test", "CONTEXT_GATHERING");
  const artifact = await artifactStore.create({ type: "markdown", title: "Test", content: "# Test", verified: true });

  assert.equal((await eventBus.summary()).total, 1);
  assert.equal(streamed.length, 1);
  assert.equal(streamed[0].type, "test.event");
  assert.equal(policy.network.default, "ask");
  assert.equal((await workflowStateStore.get("run-test")).status, "CONTEXT_GATHERING");
  assert.ok(artifact.id.startsWith("art_"));
  assert.equal((await artifactStore.summary()).total, 1);
});
