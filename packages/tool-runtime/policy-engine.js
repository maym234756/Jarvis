export const RISK_LEVELS = {
  READ_ONLY: 0,
  LOCAL_WRITE: 1,
  NETWORK_OR_PACKAGE: 2,
  SYSTEM_ACTION: 3,
  DANGEROUS: 4
};

export class PolicyEngine {
  constructor({ approvalThreshold = RISK_LEVELS.NETWORK_OR_PACKAGE, allowDangerous = false } = {}) {
    this.approvalThreshold = approvalThreshold;
    this.allowDangerous = allowDangerous;
  }

  evaluate({ toolName, riskLevel, summary }) {
    if (riskLevel >= RISK_LEVELS.DANGEROUS && !this.allowDangerous) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: "Dangerous actions are blocked by default.",
        toolName,
        riskLevel,
        summary
      };
    }

    if (riskLevel >= this.approvalThreshold) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: "This action can affect the network, packages, system settings, or external services.",
        toolName,
        riskLevel,
        summary
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      reason: "Allowed by local policy.",
      toolName,
      riskLevel,
      summary
    };
  }
}
