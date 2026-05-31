export const RISK_LEVELS = {
  low: { min: 0, max: 24 },
  medium: { min: 25, max: 54 },
  high: { min: 55, max: 79 },
  critical: { min: 80, max: 100 }
};

const DIMENSIONS = [
  "data_exposure",
  "filesystem_mutation",
  "network_access",
  "shell_execution",
  "dependency_change",
  "credential_use",
  "production_impact",
  "reversibility"
];

export class RiskScorer {
  scoreAction(input = {}) {
    const args = input.args || {};
    const text = normalize([
      input.action,
      input.tool,
      input.toolName,
      input.summary,
      input.command,
      args.command,
      args.path,
      args.url,
      input.networkTarget,
      input.filePath,
      input.workflowType
    ].filter(Boolean).join(" "));
    const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 0]));
    const reasons = [];
    const mitigations = [];

    if (Number.isFinite(input.riskLevel)) {
      dimensions.reversibility = Math.max(dimensions.reversibility, Math.min(30, input.riskLevel * 8));
      if (input.riskLevel >= 2) reasons.push(`tool risk tier ${input.riskLevel}`);
    }

    if (matches(text, [/shell\.run|powershell|cmd|bash|terminal|exec|command/])) {
      dimensions.shell_execution = 28;
      reasons.push("shell execution");
      mitigations.push("capture exit code and important output");
    }

    if (matches(text, [/https?:\/\//, /\bdownload\b/, /\bweb\b/, /\bsearch\b/, /\bapi\b/, /\bnetwork\b/, /\bcurl\b/, /\binvoke-webrequest\b/])) {
      dimensions.network_access = 25;
      reasons.push("network access");
      mitigations.push("prefer official sources and record citations");
    }

    if (matches(text, [/\bnpm install\b/, /\bpip install\b/, /\bpnpm add\b/, /\byarn add\b/, /\bapt install\b/, /\bchoco install\b/, /\bpackage\b/, /\bdependency\b/])) {
      dimensions.dependency_change = 32;
      reasons.push("dependency or package change");
      mitigations.push("pin versions and scan package source");
    }

    if (matches(text, [/\bwrite\b/, /\bpatch\b/, /\bedit\b/, /\bdelete\b/, /\bremove\b/, /\bmove\b/, /\brename\b/, /\brm\b/, /\bdel\b/])) {
      dimensions.filesystem_mutation = 22;
      reasons.push("filesystem mutation");
      mitigations.push("read before write and keep rollback path");
    }

    if (matches(text, [/\bdeploy\b/, /\bproduction\b/, /\bcloud\b/, /\bkubernetes\b/, /\bdocker\b/, /\bservice\b/, /\bregistry\b/])) {
      dimensions.production_impact = 28;
      reasons.push("production or infrastructure impact");
      mitigations.push("require approval and dry-run where possible");
    }

    if (matches(text, [/\btoken\b/, /\bsecret\b/, /\bpassword\b/, /\bapi[_ -]?key\b/, /\bcredential\b/, /\.env\b/, /\bprivate key\b/])) {
      dimensions.credential_use = 38;
      dimensions.data_exposure = Math.max(dimensions.data_exposure, 30);
      reasons.push("credential or secret-like data");
      mitigations.push("redact secrets and keep secret references out of model context");
    }

    if (input.dataSensitivity && input.dataSensitivity !== "public") {
      const sensitivityScore = {
        internal: 12,
        confidential: 24,
        secret: 38,
        regulated: 42,
        credential: 50,
        untrusted_external: 18
      }[input.dataSensitivity] || 16;
      dimensions.data_exposure = Math.max(dimensions.data_exposure, sensitivityScore);
      reasons.push(`data classified as ${input.dataSensitivity}`);
    }

    if (matches(text, [/git reset --hard/, /format\s+[a-z]:?/i, /rm\s+-rf\s+[/.]/, /remove-item.*-recurse.*-force/i, /curl.*\|\s*(sh|bash|powershell)/i, /invoke-expression/i])) {
      dimensions.reversibility = 45;
      dimensions.filesystem_mutation = Math.max(dimensions.filesystem_mutation, 45);
      reasons.push("destructive or hard-to-reverse command pattern");
      mitigations.push("block by default");
    }

    const score = Math.min(100, Math.round(Object.values(dimensions).reduce((sum, value) => sum + value, 0)));
    const level = riskLevelFor(score);
    const approvalRequired = score >= 30 || Number(input.riskLevel || 0) >= 2 || dimensions.dependency_change > 0 || dimensions.network_access > 0;
    const sandboxRecommended = score >= 45 || dimensions.shell_execution > 0 || dimensions.network_access > 0;

    return {
      score,
      level,
      approvalRequired,
      sandboxRecommended,
      dimensions,
      reasons: [...new Set(reasons)],
      mitigations: [...new Set(mitigations)],
      taxonomy: score >= 80 ? "critical_action" : score >= 55 ? "high_risk_action" : score >= 25 ? "moderate_risk_action" : "low_risk_action"
    };
  }

  scorePlan({ steps = [] } = {}) {
    const scoredSteps = steps.map((step, index) => ({
      id: step.id || `step_${index + 1}`,
      ...step,
      risk: this.scoreAction({
        action: step.action || step.name || step.tool,
        tool: step.tool,
        args: step.args || {},
        summary: step.summary,
        riskLevel: step.riskLevel,
        dataSensitivity: step.dataSensitivity,
        workflowType: step.workflowType
      })
    }));
    const maxScore = Math.max(0, ...scoredSteps.map((step) => step.risk.score));
    return {
      score: maxScore,
      level: riskLevelFor(maxScore),
      approvalRequired: scoredSteps.some((step) => step.risk.approvalRequired),
      steps: scoredSteps
    };
  }
}

export function classifyFailure(input = {}) {
  const text = normalize([
    input.error,
    input.stderr,
    input.message,
    input.toolResult?.error,
    input.toolResult?.stderr,
    input.toolResult?.summary
  ].filter(Boolean).join(" "));

  if (!text) return failure("unknown", false, "Record the missing failure detail before retrying.");
  if (matches(text, [/approval denied|policy|blocked|permission/])) return failure("policy_denied", false, "Replan without the blocked capability or request explicit approval.");
  if (matches(text, [/enoent|not found|missing file|cannot find/])) return failure("missing_context", false, "Inspect the workspace and gather the missing file or context.");
  if (matches(text, [/timeout|timed out|etimedout/])) return failure("timeout", true, "Retry with a smaller scope or longer timeout.");
  if (matches(text, [/network|econnreset|enotfound|dns|fetch failed/])) return failure("network_failure", true, "Retry later, switch provider, or continue without network.");
  if (matches(text, [/assert|test failed|expected|actual|failing test/])) return failure("test_failure", true, "Inspect the failing assertion and patch the code or test fixture.");
  if (matches(text, [/json|schema|invalid output|parse/])) return failure("model_error", true, "Retry with stricter schema instructions or repair the structured output.");
  if (matches(text, [/hallucinat|unsupported claim|citation/])) return failure("hallucination_detected", false, "Ground the answer in files, tool output, or citations before responding.");
  return failure("tool_error", true, "Inspect tool output, normalize the error, and retry only if the action is safe.");
}

function failure(type, retryable, recovery) {
  return { type, retryable, recovery };
}

function riskLevelFor(score) {
  if (score >= RISK_LEVELS.critical.min) return "critical";
  if (score >= RISK_LEVELS.high.min) return "high";
  if (score >= RISK_LEVELS.medium.min) return "medium";
  return "low";
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function matches(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}
