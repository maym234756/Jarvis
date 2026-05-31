import { RISK_LEVELS } from "../policy-engine.js";

export class EvalsRunTool {
  constructor(evalRunner) {
    this.name = "evals.run";
    this.description = "Run Jarvis backend evals for context, tool routing, search safety, and policy behavior.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["backend-evals", "quality-gates", "regression-checks"];
    this.evalRunner = evalRunner;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return args.filter ? `Run backend evals matching ${args.filter}` : "Run backend evals";
  }

  async run(args = {}) {
    const report = await this.evalRunner.run({ filter: args.filter });
    return {
      summary: report.summary,
      report
    };
  }
}
