#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { MemoryStore } from "../packages/memory/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { RunStore } from "../packages/runs/index.js";
import { SessionStore } from "../packages/session/index.js";
import { BackendDockingStation, formatDockReport } from "../packages/docking/index.js";
import { DockingStatusTool, DockingTestTool } from "../packages/tool-runtime/tools/docking-tool.js";
import { ModelRouter } from "../packages/model-router/index.js";
import { WorkflowEngine } from "../packages/workflow-engine/index.js";
import { ReasoningEngine } from "../packages/reasoning/index.js";
import { SearchEngine } from "../packages/search/index.js";
import { MetricsStore } from "../packages/metrics/index.js";
import { ConnectorRegistry } from "../packages/connectors/index.js";
import { BackendEvalRunner } from "../packages/evals/index.js";
import { EvalsRunTool } from "../packages/tool-runtime/tools/evals-tool.js";
import { PreferenceStore } from "../packages/preferences/index.js";
import { RepoIntelligence } from "../packages/repo-intelligence/index.js";
import { VerificationEngine } from "../packages/verification/index.js";
import { CapabilityBus } from "../packages/capabilities/index.js";
import { ContextBudgetManager } from "../packages/context-budget/index.js";
import { EnvironmentInspector } from "../packages/environment/index.js";
import { FeedbackStore } from "../packages/learning/index.js";
import { ModelMesh } from "../packages/model-mesh/index.js";
import { EventBus } from "../packages/events/index.js";
import { PolicyDecisionPoint, PolicyStore } from "../packages/policy/index.js";
import { WorkflowStateStore } from "../packages/workflow-state/index.js";
import { ArtifactStore } from "../packages/artifacts/index.js";
import { AIControlPlane } from "../packages/control-plane/index.js";
import { RiskScorer } from "../packages/risk/index.js";
import { RunLedger } from "../packages/run-ledger/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });

const memoryStore = new MemoryStore({ projectRoot });
const sessionStore = new SessionStore({ projectRoot });
const runStore = new RunStore({ projectRoot });
const metricsStore = new MetricsStore({ projectRoot });
const connectorRegistry = new ConnectorRegistry({ projectRoot });
const preferenceStore = new PreferenceStore({ projectRoot });
const repoIntelligence = new RepoIntelligence({ projectRoot });
const verificationEngine = new VerificationEngine();
const contextBudgetManager = new ContextBudgetManager();
const environmentInspector = new EnvironmentInspector({ projectRoot });
const feedbackStore = new FeedbackStore({ projectRoot });
const modelMesh = new ModelMesh({ feedbackStore });
const capabilityBus = new CapabilityBus();
const eventBus = new EventBus({ projectRoot });
const policyStore = new PolicyStore({ projectRoot });
const riskScorer = new RiskScorer();
const policyDecisionPoint = new PolicyDecisionPoint({ policyStore, riskScorer });
const workflowStateStore = new WorkflowStateStore({ projectRoot });
const artifactStore = new ArtifactStore({ projectRoot });
const runLedger = new RunLedger({ projectRoot });
const modelRouter = new ModelRouter();
const workflowEngine = new WorkflowEngine();
const controlPlane = new AIControlPlane({ workflowEngine, modelMesh, contextBudgetManager, capabilityBus, policyStore, riskScorer, policyDecisionPoint });
const reasoningEngine = new ReasoningEngine();
const searchEngine = new SearchEngine();
const toolRegistry = createDefaultToolRegistry({ projectRoot, memoryStore, searchEngine, metricsStore, connectorRegistry, preferenceStore, repoIntelligence, capabilityBus, environmentInspector, contextBudgetManager, feedbackStore, modelMesh, controlPlane, eventBus, policyStore, workflowStateStore, artifactStore, riskScorer, policyDecisionPoint, runLedger });
capabilityBus.setToolRegistry(toolRegistry);
controlPlane.setToolRegistry(toolRegistry).setCapabilityBus(capabilityBus);
const evalRunner = new BackendEvalRunner({ projectRoot, toolRegistry, memoryStore, searchEngine, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger });
const dockingStation = new BackendDockingStation({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger });
toolRegistry.register(new DockingStatusTool(dockingStation));
toolRegistry.register(new DockingTestTool(dockingStation));
toolRegistry.register(new EvalsRunTool(evalRunner));

const [command, id] = process.argv.slice(2);
if (command === "test") {
  if (!id) {
    console.error("Usage: npm run docks -- test <dock-id>");
    process.exit(1);
  }
  console.log(await dockingStation.testDock(id));
} else {
  console.log(formatDockReport(await dockingStation.report()));
}
