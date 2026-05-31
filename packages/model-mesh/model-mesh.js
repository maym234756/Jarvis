import { resolveRuntimeProfile } from "../runtime/index.js";

export class ModelMesh {
  constructor({ feedbackStore } = {}) {
    this.feedbackStore = feedbackStore;
  }

  listRoles() {
    return [
      role("nano-router", "Instant routing, labels, and simple formatting", ["routing", "classification"], "low"),
      role("small-summarizer", "Summaries, extraction, and quick answers", ["summary", "extraction"], "low"),
      role("medium-planner", "Normal planning and chat", ["planning", "chat"], "medium"),
      role("large-reasoning", "Architecture, hard debugging, and deep logic", ["reasoning", "architecture"], "high"),
      role("code-specialist", "Repository edits, tests, and static analysis", ["code", "tests"], "medium"),
      role("critic-verifier", "Plan critique, verification, and confidence calibration", ["verification", "critique"], "medium"),
      role("security-reviewer", "Risk, prompt injection, and permission checks", ["security", "policy"], "medium"),
      role("composer", "Final response style and structure", ["response", "formatting"], "low"),
      role("local-private", "Sensitive or offline work", ["privacy", "local"], "low")
    ];
  }

  async route({ taskType = "chat", privacyLevel = "project", runtimeProfile = "balanced", toolIntent = null } = {}) {
    const profile = typeof runtimeProfile === "string" ? resolveRuntimeProfile(runtimeProfile) : runtimeProfile;
    const feedback = this.feedbackStore ? await this.feedbackStore.summary() : null;
    const supportRoles = ["critic-verifier", "composer"];
    let primaryRole = "medium-planner";
    if (privacyLevel === "private") primaryRole = "local-private";
    else if (taskType === "coding" || taskType === "debug") primaryRole = "code-specialist";
    else if (taskType === "research") primaryRole = profile.id === "deep" ? "large-reasoning" : "medium-planner";
    else if (taskType === "security") primaryRole = "security-reviewer";
    else if (profile.id === "instant") primaryRole = "small-summarizer";
    else if (profile.id === "deep") primaryRole = "large-reasoning";
    if (toolIntent?.tool?.startsWith("shell.")) supportRoles.push("security-reviewer");

    return {
      primaryRole,
      supportRoles: [...new Set(supportRoles)],
      profile: profile.id,
      taskType,
      privacyLevel,
      confidence: !feedback || feedback.successRate === null ? "baseline" : feedback.successRate >= 0.8 ? "learned-good" : "needs-more-data",
      feedbackSignals: feedback ? {
        total: feedback.total,
        successRate: feedback.successRate,
        task: feedback.byTask?.[taskType] || null
      } : null,
      rationale: buildRationale({ taskType, privacyLevel, profile, primaryRole, toolIntent })
    };
  }
}

function role(id, description, capabilities, cost) {
  return { id, description, capabilities, cost };
}

function buildRationale({ taskType, privacyLevel, profile, primaryRole, toolIntent }) {
  const reasons = [`${taskType} task routed to ${primaryRole}.`, `${profile.id} profile requests ${profile.verificationLevel} verification.`];
  if (privacyLevel === "private") reasons.push("Private mode prefers local/private routing.");
  if (toolIntent) reasons.push(`Explicit tool intent detected: ${toolIntent.tool}.`);
  return reasons;
}
