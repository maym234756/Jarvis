import { loadEnv } from "../config/env.js";
import { createAgent } from "../agent-core/index.js";
import { createDefaultToolRegistry } from "../tool-runtime/index.js";
import { MemoryStore } from "../memory/index.js";
import { WorkflowEngine } from "../workflow-engine/index.js";
import { ModelRouter } from "../model-router/index.js";
import { SessionStore } from "../session/index.js";
import { RunStore } from "../runs/index.js";
import { BackendDockingStation } from "../docking/index.js";
import { DockingStatusTool, DockingTestTool } from "../tool-runtime/tools/docking-tool.js";
import { ReasoningEngine } from "../reasoning/index.js";
import { SearchEngine } from "../search/index.js";
import { MetricsStore } from "../metrics/index.js";
import { ConnectorRegistry } from "../connectors/index.js";
import { BackendEvalRunner } from "../evals/index.js";
import { EvalsRunTool } from "../tool-runtime/tools/evals-tool.js";
import { PreferenceStore } from "../preferences/index.js";
import { RepoIntelligence } from "../repo-intelligence/index.js";
import { VerificationEngine } from "../verification/index.js";
import { CapabilityBus } from "../capabilities/index.js";
import { ContextBudgetManager } from "../context-budget/index.js";
import { EnvironmentInspector } from "../environment/index.js";
import { FeedbackStore } from "../learning/index.js";
import { ModelMesh } from "../model-mesh/index.js";
import { EventBus } from "../events/index.js";
import { PolicyDecisionPoint, PolicyStore } from "../policy/index.js";
import { WorkflowStateStore } from "../workflow-state/index.js";
import { ArtifactStore } from "../artifacts/index.js";
import { AIControlPlane } from "../control-plane/index.js";
import { RiskScorer } from "../risk/index.js";
import { RunLedger } from "../run-ledger/index.js";
import { BackendStatusTool, BackendReadinessTool } from "../tool-runtime/tools/backend-tool.js";
import { BackendSupervisor } from "./backend-supervisor.js";

export function createBackendKernel({ projectRoot = process.cwd(), approvalProvider, port = Number(process.env.JARVIS_PORT || 8787), forceLocalDraft } = {}) {
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
  const modelRouter = new ModelRouter(forceLocalDraft === undefined ? {} : { forceLocalDraft });
  const workflowEngine = new WorkflowEngine();
  const controlPlane = new AIControlPlane({
    workflowEngine,
    modelMesh,
    contextBudgetManager,
    capabilityBus,
    policyStore,
    riskScorer,
    policyDecisionPoint
  });
  const reasoningEngine = new ReasoningEngine();
  const searchEngine = new SearchEngine();
  const toolRegistry = createDefaultToolRegistry({
    projectRoot,
    memoryStore,
    approvalProvider,
    searchEngine,
    metricsStore,
    connectorRegistry,
    preferenceStore,
    repoIntelligence,
    capabilityBus,
    environmentInspector,
    contextBudgetManager,
    feedbackStore,
    modelMesh,
    controlPlane,
    eventBus,
    policyStore,
    workflowStateStore,
    artifactStore,
    riskScorer,
    policyDecisionPoint,
    runLedger
  });
  capabilityBus.setToolRegistry(toolRegistry);
  controlPlane.setToolRegistry(toolRegistry).setCapabilityBus(capabilityBus);

  const evalRunner = new BackendEvalRunner({
    projectRoot,
    toolRegistry,
    memoryStore,
    searchEngine,
    preferenceStore,
    repoIntelligence,
    verificationEngine,
    contextBudgetManager,
    environmentInspector,
    capabilityBus,
    feedbackStore,
    modelMesh,
    eventBus,
    policyStore,
    workflowStateStore,
    artifactStore,
    controlPlane,
    riskScorer,
    policyDecisionPoint,
    runLedger
  });

  const dockingStation = new BackendDockingStation({
    projectRoot,
    memoryStore,
    toolRegistry,
    runStore,
    sessionStore,
    modelRouter,
    reasoningEngine,
    searchEngine,
    workflowEngine,
    metricsStore,
    connectorRegistry,
    evalRunner,
    preferenceStore,
    repoIntelligence,
    verificationEngine,
    contextBudgetManager,
    environmentInspector,
    capabilityBus,
    feedbackStore,
    modelMesh,
    eventBus,
    policyStore,
    workflowStateStore,
    artifactStore,
    controlPlane,
    riskScorer,
    policyDecisionPoint,
    runLedger
  });

  toolRegistry.register(new DockingStatusTool(dockingStation));
  toolRegistry.register(new DockingTestTool(dockingStation));
  toolRegistry.register(new EvalsRunTool(evalRunner));

  const agent = createAgent({
    projectRoot,
    modelRouter,
    toolRegistry,
    memoryStore,
    workflowEngine,
    sessionStore,
    runStore,
    reasoningEngine,
    verificationEngine,
    preferenceStore,
    contextBudgetManager,
    feedbackStore,
    modelMesh,
    eventBus,
    workflowStateStore,
    artifactStore,
    riskScorer,
    policyDecisionPoint,
    runLedger
  });

  const services = {
    agent,
    approvalProvider,
    memoryStore,
    sessionStore,
    runStore,
    metricsStore,
    connectorRegistry,
    preferenceStore,
    repoIntelligence,
    verificationEngine,
    contextBudgetManager,
    environmentInspector,
    feedbackStore,
    modelMesh,
    capabilityBus,
    eventBus,
    policyStore,
    riskScorer,
    policyDecisionPoint,
    workflowStateStore,
    artifactStore,
    runLedger,
    modelRouter,
    workflowEngine,
    controlPlane,
    reasoningEngine,
    searchEngine,
    toolRegistry,
    evalRunner,
    dockingStation
  };
  const backendSupervisor = new BackendSupervisor({ projectRoot, services, port });
  services.backendSupervisor = backendSupervisor;
  dockingStation.setBackendSupervisor?.(backendSupervisor);
  toolRegistry.register(new BackendStatusTool(backendSupervisor));
  toolRegistry.register(new BackendReadinessTool(backendSupervisor));

  return {
    projectRoot,
    ...services
  };
}
