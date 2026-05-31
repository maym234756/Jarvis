export class RiskScoreTool {
  constructor(riskScorer) {
    this.name = "risk.score";
    this.description = "Score the risk of a planned action or tool call before execution.";
    this.riskLevel = 0;
    this.capabilities = ["risk-scoring", "preflight", "safety"];
    this.riskScorer = riskScorer;
  }

  async assessRisk() {
    return 0;
  }

  summarize(args = {}) {
    return `Score risk for ${args.tool || args.action || "action"}`;
  }

  async run(args = {}) {
    const risk = this.riskScorer.scoreAction(args);
    return {
      summary: `${risk.level} risk (${risk.score}/100)`,
      risk
    };
  }
}

export class FailureClassifyTool {
  constructor(classifyFailure) {
    this.name = "failure.classify";
    this.description = "Classify tool/model/backend failures and suggest a recovery playbook.";
    this.riskLevel = 0;
    this.capabilities = ["failure-taxonomy", "recovery-playbook"];
    this.classifyFailure = classifyFailure;
  }

  async assessRisk() {
    return 0;
  }

  summarize() {
    return "Classify failure and recovery path";
  }

  async run(args = {}) {
    const failure = this.classifyFailure(args);
    return {
      summary: `${failure.type}${failure.retryable ? " (retryable)" : ""}`,
      failure
    };
  }
}
