export class PolicyDecisionTool {
  constructor(policyDecisionPoint) {
    this.name = "policy.decide";
    this.description = "Run the policy decision point for a proposed action: allow, deny, approval-required, or sandbox-only.";
    this.riskLevel = 0;
    this.capabilities = ["policy-decision", "risk-preflight", "approval-routing"];
    this.policyDecisionPoint = policyDecisionPoint;
  }

  async assessRisk() {
    return 0;
  }

  summarize(args = {}) {
    return `Policy decision for ${args.tool || args.action || "action"}`;
  }

  async run(args = {}) {
    const decision = await this.policyDecisionPoint.decide(args);
    return {
      summary: `${decision.decision}: ${decision.reason}`,
      decision
    };
  }
}
