import { RISK_LEVELS } from "../policy-engine.js";

export class ControlPlaneDecideTool {
  constructor(controlPlane) {
    this.name = "control.decide";
    this.description = "Preview the AI control-plane decision for a request: workflow, model route, tools, policy, and context budget.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["control-plane", "routing-preview", "workflow-preview"];
    this.controlPlane = controlPlane;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Control-plane decision for "${args.message || ""}"`;
  }

  async run(args = {}) {
    const decision = await this.controlPlane.decide(args);
    return {
      summary: `${decision.taskType} -> ${decision.workflow?.name || "no workflow"} via ${decision.modelRoute?.primaryRole || "default route"}`,
      decision
    };
  }
}
