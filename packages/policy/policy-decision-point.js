import { RiskScorer } from "../risk/index.js";

export class PolicyDecisionPoint {
  constructor({ policyStore, riskScorer } = {}) {
    this.policyStore = policyStore;
    this.riskScorer = riskScorer || new RiskScorer();
  }

  async decide(input = {}) {
    const policy = this.policyStore ? await this.policyStore.getPolicy() : defaultPolicy();
    const risk = this.riskScorer.scoreAction(input);
    const text = normalize([
      input.action,
      input.tool,
      input.toolName,
      input.summary,
      input.command,
      input.args?.command,
      input.args?.path,
      input.args?.url,
      input.networkTarget,
      input.filePath
    ].filter(Boolean).join(" "));
    const reasons = [...risk.reasons];
    const conditions = [...risk.mitigations];

    for (const pattern of policy.shell?.blockPatterns || []) {
      if (text.includes(normalize(pattern))) {
        return buildDecision("deny", `Blocked by shell policy pattern: ${pattern}`, risk, reasons, conditions);
      }
    }

    for (const blockedPath of policy.files?.blockPaths || []) {
      const normalizedPath = normalize(blockedPath);
      if (normalizedPath && text.includes(normalizedPath)) {
        return buildDecision("deny", `Blocked path by file policy: ${blockedPath}`, risk, reasons, conditions);
      }
    }

    if (policy.secrets?.neverSendToModel && risk.dimensions.credential_use > 0 && input.destination === "model") {
      return buildDecision("deny", "Secrets are never sent directly to model context.", risk, reasons, conditions);
    }

    if (risk.reasons.includes("destructive or hard-to-reverse command pattern")) {
      return buildDecision("deny", "Destructive or hard-to-reverse actions are blocked by default.", risk, reasons, conditions);
    }

    if (risk.score >= 80) {
      conditions.push("manual review required");
      return buildDecision("approval_required", "Critical risk action requires explicit approval.", risk, reasons, conditions);
    }

    if (risk.dimensions.network_access > 0 && policy.network?.default === "ask" && !isAllowedDomain(input.networkTarget || input.args?.url, policy.network?.allowDomains || [])) {
      conditions.push("official source preferred");
      return buildDecision("approval_required", "Network access requires approval by policy.", risk, reasons, conditions);
    }

    if (risk.approvalRequired) {
      return buildDecision("approval_required", "Risk score requires user approval.", risk, reasons, conditions);
    }

    if (risk.sandboxRecommended) {
      conditions.push("run in sandbox when available");
      return buildDecision("sandbox_only", "Action is allowed only with sandbox controls.", risk, reasons, conditions);
    }

    return buildDecision("allow", "Allowed by policy decision point.", risk, reasons, conditions);
  }
}

function buildDecision(decision, reason, risk, reasons, conditions) {
  return {
    decision,
    allowed: decision !== "deny",
    requiresApproval: decision === "approval_required",
    sandboxRequired: decision === "sandbox_only",
    reason,
    risk,
    reasons: [...new Set(reasons)],
    conditions: [...new Set(conditions)]
  };
}

function isAllowedDomain(target = "", allowDomains = []) {
  if (!target) return false;
  let host = "";
  try {
    host = new URL(target).hostname;
  } catch {
    host = target;
  }
  return allowDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function defaultPolicy() {
  return {
    network: { default: "ask", allowDomains: [] },
    shell: { blockPatterns: [] },
    files: { blockPaths: [] },
    secrets: { neverSendToModel: true }
  };
}
