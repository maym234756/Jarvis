import { classifyTask, createPlan, parseToolIntent } from "../agent-core/planner.js";
import { resolveRuntimeProfile } from "../runtime/index.js";
import { chooseResponseMode } from "../response/index.js";

export class AIControlPlane {
  constructor({ workflowEngine, toolRegistry, modelMesh, contextBudgetManager, capabilityBus, policyStore, riskScorer, policyDecisionPoint } = {}) {
    this.workflowEngine = workflowEngine;
    this.toolRegistry = toolRegistry;
    this.modelMesh = modelMesh;
    this.contextBudgetManager = contextBudgetManager;
    this.capabilityBus = capabilityBus;
    this.policyStore = policyStore;
    this.riskScorer = riskScorer;
    this.policyDecisionPoint = policyDecisionPoint;
  }

  setToolRegistry(toolRegistry) {
    this.toolRegistry = toolRegistry;
    return this;
  }

  setCapabilityBus(capabilityBus) {
    this.capabilityBus = capabilityBus;
    return this;
  }

  async decide({ message = "", mode = "agent", privacyLevel = "project", runtimeProfile = "balanced" } = {}) {
    const profile = resolveRuntimeProfile(runtimeProfile);
    const taskType = classifyTask(message, mode);
    const workflow = this.workflowEngine?.select(taskType) || null;
    const plan = createPlan(message, taskType);
    const toolIntent = parseToolIntent(message);
    const responseMode = chooseResponseMode({ message, taskType, toolIntent, runtimeProfile: profile });
    const modelRoute = this.modelMesh ? await this.modelMesh.route({ taskType, privacyLevel, runtimeProfile: profile, toolIntent }) : null;
    const relevantTools = this.toolRegistry?.searchTools ? this.toolRegistry.searchTools(message, { limit: 6 }) : [];
    const capabilities = this.capabilityBus ? this.capabilityBus.search(message, { limit: 6 }) : [];
    const contextBudget = this.contextBudgetManager ? this.contextBudgetManager.allocate({ message, taskType, runtimeProfile: profile }) : null;
    const policy = this.policyStore ? await this.policyStore.status() : null;
    const planRisk = this.riskScorer ? this.riskScorer.scorePlan({
      steps: plan.map((step, index) => ({
        id: `plan_${index + 1}`,
        action: step,
        tool: toolIntent?.tool || relevantTools[index]?.name,
        riskLevel: toolIntent ? relevantTools.find((tool) => tool.name === toolIntent.tool)?.riskLevel : relevantTools[index]?.riskLevel,
        workflowType: workflow?.name
      }))
    }) : null;
    const policyDecision = this.policyDecisionPoint ? await this.policyDecisionPoint.decide({
      action: message,
      tool: toolIntent?.tool,
      args: toolIntent?.args || {},
      riskLevel: relevantTools.find((tool) => tool.name === toolIntent?.tool)?.riskLevel,
      workflowType: workflow?.name,
      dataSensitivity: privacyLevel === "private" ? "confidential" : "internal"
    }) : null;
    return {
      generated_at: new Date().toISOString(),
      taskType,
      workflow,
      plan,
      toolIntent,
      responseMode,
      runtimeProfile: profile,
      modelRoute,
      relevantTools,
      capabilities,
      contextBudget,
      policy,
      planRisk,
      policyDecision,
      approvalRequired: Boolean(policyDecision?.requiresApproval) || relevantTools.some((tool) => tool.riskLevel >= 2),
      statePlan: {
        initial: "NEW",
        expected: ["CONTEXT_GATHERING", "PLAN_READY", "EXECUTING", "VERIFYING", "COMPLETE"]
      }
    };
  }
}
