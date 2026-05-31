import { RISK_LEVELS } from "../policy-engine.js";

export class WorkflowStateListTool {
  constructor(workflowStateStore) {
    this.name = "workflow.state";
    this.description = "List recent workflow runtime states.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["workflow-state", "agent-state", "observability"];
    this.workflowStateStore = workflowStateStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `List ${args.limit || 20} workflow states`;
  }

  async run(args = {}) {
    const states = await this.workflowStateStore.list({ limit: args.limit || 20 });
    return {
      summary: `${states.length} workflow state(s)`,
      states
    };
  }
}
