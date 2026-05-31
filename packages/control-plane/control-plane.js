import { classifyTask, createPlan, parseToolIntent } from "../agent-core/planner.js";
import { resolveRuntimeProfile } from "../runtime/index.js";
import { chooseResponseMode } from "../response/index.js";

export class AIControlPlane {
  constructor({ workflowEngine, toolRegistry, modelMesh, contextBudgetManager, capabilityBus, policyStore } = {}) {
    this.workflowEngine = workflowEngine;
    this.toolRegistry = toolRegistry;
    this.modelMesh = modelMesh;
    this.contextBudgetManager = contextBudgetManager;
    this.capabilityBus = capabilityBus;
    this.policyStore = policyStore;
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
      approvalRequired: relevantTools.some((tool) => tool.riskLevel >= 2),
      statePlan: {
        initial: "NEW",
        expected: ["CONTEXT_GATHERING", "PLAN_READY", "EXECUTING", "VERIFYING", "COMPLETE"]
      }
    };
  }
}
