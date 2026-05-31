import { RISK_LEVELS } from "../policy-engine.js";

export class ContextBudgetTool {
  constructor(contextBudgetManager) {
    this.name = "context.budget";
    this.description = "Estimate and allocate context budget by task type and runtime profile.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["context-budget", "token-planning", "prompt-compression"];
    this.contextBudgetManager = contextBudgetManager;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Estimate context budget for ${args.taskType || "chat"}`;
  }

  async run(args = {}) {
    const budget = this.contextBudgetManager.allocate(args);
    return {
      summary: `${budget.profile}/${budget.taskType}: ${budget.total_context} token context, pressure ${budget.pressure.level}`,
      budget
    };
  }
}
