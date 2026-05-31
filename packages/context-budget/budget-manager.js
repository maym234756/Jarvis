import { resolveRuntimeProfile } from "../runtime/index.js";

const DEFAULT_TOTALS = {
  instant: 24000,
  balanced: 96000,
  deep: 200000
};

export class ContextBudgetManager {
  allocate({ message = "", taskType = "chat", runtimeProfile = "balanced", sessionHistory = [], memoryContext = [], toolResults = [], repoMap = null } = {}) {
    const profile = typeof runtimeProfile === "string" ? resolveRuntimeProfile(runtimeProfile) : runtimeProfile;
    const total = DEFAULT_TOTALS[profile?.id] || DEFAULT_TOTALS.balanced;
    const weights = weightsFor(taskType, profile?.id);
    const allocations = Object.fromEntries(Object.entries(weights).map(([key, weight]) => [key, Math.floor(total * weight)]));
    const usage = {
      request: estimateTokens(message),
      conversation: estimateTokens(sessionHistory.map((item) => item.content || "").join("\n")),
      memory: estimateTokens(memoryContext.map((item) => item.text || "").join("\n")),
      toolResults: estimateTokens(toolResults.map((item) => JSON.stringify(slimToolResult(item))).join("\n")),
      repo: estimateTokens(JSON.stringify(repoMap?.summary || {}))
    };

    return {
      profile: profile?.id || "balanced",
      taskType,
      total_context: total,
      allocations,
      estimated_usage: usage,
      pressure: pressureFor(usage, allocations),
      recommendations: recommendationsFor(usage, allocations)
    };
  }
}

function weightsFor(taskType, profileId) {
  if (taskType === "coding" || taskType === "debug") {
    return {
      system: 0.08,
      request: 0.05,
      conversation: 0.08,
      retrieval: 0.14,
      code: profileId === "deep" ? 0.38 : 0.3,
      tool_results: 0.12,
      memory: 0.08,
      output: profileId === "instant" ? 0.08 : 0.15
    };
  }
  if (taskType === "research") {
    return {
      system: 0.08,
      request: 0.05,
      conversation: 0.08,
      retrieval: 0.42,
      code: 0.04,
      tool_results: 0.12,
      memory: 0.08,
      output: 0.13
    };
  }
  return {
    system: 0.1,
    request: 0.08,
    conversation: 0.16,
    retrieval: 0.22,
    code: 0.08,
    tool_results: 0.12,
    memory: 0.1,
    output: 0.14
  };
}

function pressureFor(usage, allocations) {
  const pairs = [
    ["request", "request"],
    ["conversation", "conversation"],
    ["memory", "memory"],
    ["toolResults", "tool_results"],
    ["repo", "code"]
  ];
  const pressure = pairs.map(([usageKey, allocationKey]) => {
    const used = usage[usageKey] || 0;
    const budget = allocations[allocationKey] || 1;
    return { area: allocationKey, used, budget, ratio: Number((used / budget).toFixed(3)) };
  });
  const max = Math.max(...pressure.map((item) => item.ratio));
  return {
    level: max > 1 ? "over" : max > 0.75 ? "high" : max > 0.45 ? "medium" : "low",
    areas: pressure
  };
}

function recommendationsFor(usage, allocations) {
  const recommendations = [];
  if (usage.conversation > allocations.conversation) recommendations.push("Compact older conversation turns before model call.");
  if (usage.toolResults > allocations.tool_results) recommendations.push("Summarize verbose tool output and keep only errors, diffs, and final status.");
  if (usage.memory > allocations.memory) recommendations.push("Rerank memory results and keep high-confidence records only.");
  if (usage.repo > allocations.code) recommendations.push("Use repository intelligence to select files/symbols before reading broad code context.");
  if (!recommendations.length) recommendations.push("Context pressure is acceptable.");
  return recommendations;
}

function estimateTokens(value = "") {
  return Math.ceil(String(value || "").length / 4);
}

function slimToolResult(result = {}) {
  return {
    tool: result.tool,
    ok: result.ok,
    summary: result.summary,
    error: result.error,
    pendingApproval: result.pendingApproval
  };
}
