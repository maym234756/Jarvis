export const RUNTIME_PROFILES = {
  instant: {
    id: "instant",
    label: "Fast",
    latencyBudgetMs: 2000,
    costBudget: "low",
    verificationLevel: "light",
    maxToolCalls: 1,
    allowNetworkByDefault: false,
    modelRole: "fast",
    responseDepth: "concise"
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    latencyBudgetMs: 20000,
    costBudget: "medium",
    verificationLevel: "standard",
    maxToolCalls: 4,
    allowNetworkByDefault: true,
    modelRole: "reasoning",
    responseDepth: "normal"
  },
  deep: {
    id: "deep",
    label: "Deep",
    latencyBudgetMs: 180000,
    costBudget: "high",
    verificationLevel: "strict",
    maxToolCalls: 10,
    allowNetworkByDefault: true,
    modelRole: "strong-reasoning",
    responseDepth: "detailed"
  }
};

export function resolveRuntimeProfile(value = "balanced") {
  const key = String(value || "balanced").trim().toLowerCase();
  return RUNTIME_PROFILES[key] || RUNTIME_PROFILES.balanced;
}

export function listRuntimeProfiles() {
  return Object.values(RUNTIME_PROFILES);
}
