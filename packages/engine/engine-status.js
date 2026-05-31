import { listRuntimeProfiles } from "../runtime/index.js";
import { listResponseModes } from "../response/index.js";

export async function getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger, backendSupervisor } = {}) {
  const repoMap = repoIntelligence ? await repoIntelligence.buildMap({ maxFiles: 250 }) : null;
  const feedback = feedbackStore ? await feedbackStore.summary() : null;
  return {
    generated_at: new Date().toISOString(),
    backend: backendSupervisor ? await backendSupervisor.readiness() : null,
    reasoning: {
      available: Boolean(reasoningEngine),
      capabilities: ["task-traits", "evidence-needs", "risk-notes", "answer-contracts", "logic-graph"]
    },
    verification: {
      available: Boolean(verificationEngine),
      capabilities: ["plan-checks", "tool-result-checks", "citation-checks", "coding-verification", "confidence-labels"]
    },
    runtimeProfiles: listRuntimeProfiles(),
    responseModes: listResponseModes(),
    contextBudget: contextBudgetManager ? contextBudgetManager.allocate({ taskType: "chat", runtimeProfile: "balanced" }) : null,
    environment: environmentInspector ? await environmentInspector.inspect() : null,
    modelMesh: modelMesh ? {
      roles: modelMesh.listRoles(),
      route: await modelMesh.route({ taskType: "chat", runtimeProfile: "balanced" })
    } : null,
    controlPlane: controlPlane ? await controlPlane.decide({ message: "status check", mode: "agent", runtimeProfile: "balanced" }) : null,
    search: {
      available: Boolean(searchEngine),
      capabilities: ["query-planning", "dedupe", "source-ranking", "fetch", "snippet-extraction", "citations", "prompt-injection-scan"],
      cache: searchEngine?.cacheStatus ? searchEngine.cacheStatus() : null
    },
    tools: {
      count: toolRegistry?.listTools ? toolRegistry.listTools().length : 0,
      capabilities: ["tool-search", "risk-routing", "approval-gates"]
    },
    capabilityBus: capabilityBus ? {
      contracts: capabilityBus.listCapabilities().length,
      sample: capabilityBus.listCapabilities().slice(0, 8).map((item) => item.name)
    } : null,
    connectors: connectorRegistry ? await connectorRegistry.status() : null,
    preferences: preferenceStore ? await preferenceStore.stats() : null,
    repo: repoMap ? { summary: repoMap.summary, tests: repoMap.tests, languages: repoMap.languages } : null,
    feedback,
    events: eventBus ? await eventBus.summary() : null,
    policy: policyStore ? await policyStore.status() : null,
    policyDecisionPoint: policyDecisionPoint ? await policyDecisionPoint.decide({ action: "status check", dataSensitivity: "internal" }) : null,
    risk: riskScorer ? riskScorer.scoreAction({ action: "status check", dataSensitivity: "internal" }) : null,
    workflowState: workflowStateStore ? await workflowStateStore.summary() : null,
    artifacts: artifactStore ? await artifactStore.summary() : null,
    runLedger: runLedger ? await runLedger.summary() : null,
    evals: evalRunner ? await evalRunner.run() : null,
    memory: {
      cache: memoryStore?.cacheStatus ? memoryStore.cacheStatus() : null
    },
    metrics: metricsStore ? await metricsStore.summary() : null,
    modelRouter: modelRouter?.describe ? modelRouter.describe({ privacyLevel: "project", runtimeProfile: listRuntimeProfiles().find((profile) => profile.id === "balanced") }) : null,
    workflows: workflowEngine?.list ? workflowEngine.list().map((workflow) => workflow.name) : []
  };
}
