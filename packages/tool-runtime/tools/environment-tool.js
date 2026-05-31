import { RISK_LEVELS } from "../policy-engine.js";

export class EnvironmentInspectTool {
  constructor(environmentInspector) {
    this.name = "environment.inspect";
    this.description = "Inspect Jarvis runtime environment, OS, shell, package manager, git state, and resources.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["environment-awareness", "runtime-inspection", "git-status"];
    this.environmentInspector = environmentInspector;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Inspect environment";
  }

  async run() {
    const environment = await this.environmentInspector.inspect();
    return {
      summary: `${environment.os.platform}/${environment.os.arch}, package manager ${environment.packageManager || "unknown"}, git ${environment.git.available ? "available" : "unavailable"}`,
      environment
    };
  }
}
