import { RISK_LEVELS } from "../policy-engine.js";

export class PolicyShowTool {
  constructor(policyStore) {
    this.name = "policy.show";
    this.description = "Show active Jarvis policy-as-code configuration.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["policy-as-code", "governance", "safety"];
    this.policyStore = policyStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Show active policy";
  }

  async run() {
    const policy = await this.policyStore.getPolicy();
    return {
      summary: `Policy v${policy.version}, network default ${policy.network.default}`,
      policy
    };
  }
}

export class PolicyStatusTool {
  constructor(policyStore) {
    this.name = "policy.status";
    this.description = "Show policy-as-code backend status.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["policy-as-code", "governance"];
    this.policyStore = policyStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Show policy status";
  }

  async run() {
    const status = await this.policyStore.status();
    return {
      summary: `Policy ${status.configured ? "configured" : "using defaults"}`,
      status
    };
  }
}
