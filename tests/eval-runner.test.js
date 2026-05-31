import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BackendEvalRunner } from "../packages/evals/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { MemoryStore } from "../packages/memory/index.js";
import { SearchEngine } from "../packages/search/index.js";
import { PreferenceStore } from "../packages/preferences/index.js";
import { RepoIntelligence } from "../packages/repo-intelligence/index.js";
import { VerificationEngine } from "../packages/verification/index.js";
import { ContextBudgetManager } from "../packages/context-budget/index.js";
import { EnvironmentInspector } from "../packages/environment/index.js";
import { FeedbackStore } from "../packages/learning/index.js";
import { ModelMesh } from "../packages/model-mesh/index.js";
import { CapabilityBus } from "../packages/capabilities/index.js";
import { EventBus } from "../packages/events/index.js";
import { PolicyStore } from "../packages/policy/index.js";
import { WorkflowStateStore } from "../packages/workflow-state/index.js";
import { ArtifactStore } from "../packages/artifacts/index.js";
import { AIControlPlane } from "../packages/control-plane/index.js";
import { WorkflowEngine } from "../packages/workflow-engine/index.js";

test("backend eval runner checks core runtime behavior", async (t) => {
  const root = path.join(process.cwd(), ".test-output", `evals-${Date.now()}`);
  t.after(async () => {
    await fs.promises.rm(root, { recursive: true, force: true });
  });

  const memoryStore = new MemoryStore({ projectRoot: root });
  const searchEngine = new SearchEngine();
  const preferenceStore = new PreferenceStore({ projectRoot: root });
  const repoIntelligence = new RepoIntelligence({ projectRoot: process.cwd() });
  const verificationEngine = new VerificationEngine();
  const contextBudgetManager = new ContextBudgetManager();
  const environmentInspector = new EnvironmentInspector({ projectRoot: root });
  const feedbackStore = new FeedbackStore({ projectRoot: root });
  const modelMesh = new ModelMesh({ feedbackStore });
  const capabilityBus = new CapabilityBus();
  const eventBus = new EventBus({ projectRoot: root });
  const policyStore = new PolicyStore({ projectRoot: root });
  const workflowStateStore = new WorkflowStateStore({ projectRoot: root });
  const artifactStore = new ArtifactStore({ projectRoot: root });
  const controlPlane = new AIControlPlane({
    workflowEngine: new WorkflowEngine(),
    modelMesh,
    contextBudgetManager,
    capabilityBus,
    policyStore
  });
  const toolRegistry = createDefaultToolRegistry({
    projectRoot: root,
    memoryStore,
    searchEngine,
    preferenceStore,
    repoIntelligence,
    capabilityBus,
    contextBudgetManager,
    environmentInspector,
    feedbackStore,
    modelMesh,
    controlPlane,
    eventBus,
    policyStore,
    workflowStateStore,
    artifactStore
  });
  capabilityBus.setToolRegistry(toolRegistry);
  controlPlane.setToolRegistry(toolRegistry).setCapabilityBus(capabilityBus);
  const evalRunner = new BackendEvalRunner({ projectRoot: root, toolRegistry, memoryStore, searchEngine, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane });
  const report = await evalRunner.run();

  assert.equal(report.ok, true);
  assert.ok(report.results.some((item) => item.id === "tool_search_finds_shell_runner"));
  assert.ok(report.results.some((item) => item.id === "capability_simulates_dangerous_shell"));
  assert.ok(report.results.some((item) => item.id === "control_plane_decides_workflow_and_route"));
  assert.ok(report.results.some((item) => item.id === "artifact_store_creates_metadata"));
});
