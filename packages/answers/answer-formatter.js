export class AnswerFormatter {
  formatLocalDraft(request) {
    const toolSummary = formatToolSummary(request.toolResults);
    const evidence = collectEvidence(request);
    const nextSteps = buildNextSteps(request);
    const caveats = buildCaveats(request);
    const verification = formatVerification(request.verificationReport);

    if (toolSummary) {
      return [
        section("Result", "I handled the explicit backend step."),
        section("Tool Output", toolSummary),
        verification ? section("Verification", verification) : "",
        evidence ? section("Evidence", evidence) : "",
        caveats ? section("Caveats", caveats) : "",
        nextSteps ? section("Next Steps", nextSteps) : ""
      ].filter(Boolean).join("\n\n");
    }

    return [
      section("Answer", request.memoryContext?.length
        ? `I found ${request.memoryContext.length} related memory chunk(s), but no real LLM provider is configured yet.`
        : "No real LLM provider is configured yet, so I can only give a structured local draft."),
      section("Context", "Set OPENAI_API_KEY for an OpenAI-compatible hosted model or OLLAMA_BASE_URL for a local Ollama model."),
      verification ? section("Verification", verification) : "",
      evidence ? section("Evidence", evidence) : "",
      section("Next Steps", nextSteps || "Use direct tool prompts like `read README.md`, `run npm test`, `docks`, `research query`, or configure a model provider.")
    ].filter(Boolean).join("\n\n");
  }
}

export function buildAnswerInstructions(contract) {
  const sections = contract?.sections?.length ? contract.sections.join(", ") : "Answer, Evidence, Next Steps";
  return [
    "Use clear section headers.",
    `Preferred sections: ${sections}.`,
    "Lead with the answer, then evidence or tool results.",
    "Use bullets only when they improve scanability.",
    contract?.citationRequired ? "Cite source URLs or memory citations for factual claims." : "Cite memory/tool sources when they are used.",
    "If information is missing, say what is missing and what would unlock precision."
  ].join(" ");
}

function formatToolSummary(toolResults = []) {
  if (!toolResults.length) return "";
  return toolResults.map((result) => {
    const status = result.ok ? "ok" : result.pendingApproval ? `pending approval${result.approvalId ? ` (${result.approvalId})` : ""}` : "failed";
    const lines = [`${result.tool}: ${status}`];
    if (result.summary) lines.push(result.summary);
    if (result.error) lines.push(`Error: ${result.error}`);
    if (result.reason) lines.push(`Reason: ${result.reason}`);
    if (typeof result.duration_ms === "number") lines.push(`Duration: ${result.duration_ms}ms`);
    lines.push(...toolSpecificLines(result));
    return lines.join("\n");
  }).join("\n\n");
}

function toolSpecificLines(result) {
  if (!result.ok) return [];
  if (result.tool === "file.read" && typeof result.content === "string") {
    return ["", "Preview:", limitBlock(result.content, 1600)];
  }
  if (result.tool === "file.list" && Array.isArray(result.files)) {
    return ["", "Files:", result.files.slice(0, 40).map((file) => `- ${file.type}: ${file.name}`).join("\n")];
  }
  if (result.tool === "shell.run") {
    const lines = [];
    if (result.stdout) lines.push("", "Stdout:", limitBlock(result.stdout, 1600));
    if (result.stderr) lines.push("", "Stderr:", limitBlock(result.stderr, 1200));
    return lines;
  }
  if (result.tool === "memory.stats" && result.stats) {
    return ["", JSON.stringify(result.stats, null, 2)];
  }
  if (result.tool === "docking.status" && result.report) {
    return ["", `Docks: ${result.report.summary.ok} ok, ${result.report.summary.warn} warning, ${result.report.summary.error} error`];
  }
  if (result.tool === "tool.search" && result.tools?.length) {
    return ["", "Tools:", result.tools.slice(0, 8).map((tool) => `- ${tool.name} (tier ${tool.riskLevel}, score ${tool.score}): ${tool.description}`).join("\n")];
  }
  if (result.tool === "connector.list" && result.connectors?.length) {
    return ["", "Connectors:", result.connectors.map((connector) => `- ${connector.id} (${connector.type}) ${connector.enabled ? "enabled" : "disabled"} ${connector.url || "no-url"}`).join("\n")];
  }
  if (result.tool === "connector.add" && result.connector) {
    return ["", JSON.stringify(result.connector, null, 2)];
  }
  if (result.tool === "evals.run" && result.report) {
    return ["", result.report.results.map((item) => `- ${item.ok ? "OK" : "FAIL"} ${item.id}: ${item.summary}`).join("\n")];
  }
  if (result.tool === "preferences.get" && result.preferences) {
    return ["", "Preferences:", result.preferences.map((item) => `- ${item.key}: ${item.value}`).join("\n") || "No active preferences."];
  }
  if (result.tool === "preferences.set" && result.preference) {
    return ["", `${result.preference.key}: ${result.preference.value}`];
  }
  if (result.tool === "repo.map" && result.map) {
    return ["", [
      `Package: ${result.map.package?.name || "unknown"}`,
      `Files: ${result.map.summary.files}`,
      `Code files: ${result.map.summary.codeFiles}`,
      `Test files: ${result.map.tests.files.length}`,
      `Scripts: ${result.map.summary.scripts.join(", ") || "none"}`,
      `Top symbols: ${result.map.symbols.slice(0, 8).map((symbol) => `${symbol.name} (${symbol.path})`).join("; ") || "none"}`
    ].join("\n")];
  }
  if (result.tool === "capability.search" && result.capabilities?.length) {
    return ["", "Capabilities:", result.capabilities.map((item) => `- ${item.name} tier ${item.riskLevel}: ${(item.capabilities || []).join(", ")}`).join("\n")];
  }
  if (result.tool === "capability.list" && result.capabilities?.length) {
    return ["", `Capability contracts: ${result.capabilities.length}`];
  }
  if (result.tool === "capability.simulate" && result.simulation) {
    return ["", JSON.stringify({
      tool: result.simulation.tool,
      riskLevel: result.simulation.riskLevel,
      allowed: result.simulation.ok,
      requiresApproval: result.simulation.decision?.requiresApproval,
      expectedEffects: result.simulation.expectedEffects,
      reason: result.simulation.decision?.reason
    }, null, 2)];
  }
  if (result.tool === "environment.inspect" && result.environment) {
    return ["", JSON.stringify({
      os: result.environment.os,
      shell: result.environment.shell,
      packageManager: result.environment.packageManager,
      git: result.environment.git,
      resources: result.environment.resources
    }, null, 2)];
  }
  if (result.tool === "context.budget" && result.budget) {
    return ["", JSON.stringify({
      profile: result.budget.profile,
      total_context: result.budget.total_context,
      pressure: result.budget.pressure.level,
      recommendations: result.budget.recommendations
    }, null, 2)];
  }
  if (result.tool === "feedback.summary" && result.feedback) {
    return ["", JSON.stringify(result.feedback, null, 2)];
  }
  if (result.tool === "modelmesh.route" && result.route) {
    return ["", JSON.stringify(result.route, null, 2)];
  }
  if (result.tool === "control.decide" && result.decision) {
    return ["", JSON.stringify({
      taskType: result.decision.taskType,
      workflow: result.decision.workflow?.name,
      model: result.decision.modelRoute?.primaryRole,
      responseMode: result.decision.responseMode?.id,
      approvalRequired: result.decision.approvalRequired,
      tools: result.decision.relevantTools?.map((tool) => tool.name)
    }, null, 2)];
  }
  if (result.tool === "events.summary" && result.events) return ["", JSON.stringify(result.events, null, 2)];
  if (result.tool === "events.list" && result.events) return ["", result.events.map((event) => `${event.timestamp} ${event.type}`).join("\n")];
  if (result.tool === "policy.show" && result.policy) return ["", JSON.stringify(result.policy, null, 2)];
  if (result.tool === "workflow.state" && result.states) return ["", result.states.map((state) => `${state.runId}: ${state.status} ${state.workflow}`).join("\n") || "No workflow states."];
  if (result.tool === "artifact.list" && result.artifacts) return ["", result.artifacts.map((artifact) => `${artifact.id}: ${artifact.type} ${artifact.title}`).join("\n") || "No artifacts."];
  if (result.results?.length) {
    return ["", "Results:", result.results.slice(0, 6).map((item, index) => `${index + 1}. ${item.title} - ${item.url}`).join("\n")];
  }
  if (result.citations?.length) {
    return ["", "Citations:", result.citations.slice(0, 6).map((item) => {
      const injection = item.injection?.level && item.injection.level !== "none" ? ` injection:${item.injection.level}` : "";
      return `- [${item.id}] ${item.title} - ${item.url}${injection}`;
    }).join("\n")];
  }
  return [];
}

function collectEvidence(request) {
  const memory = (request.memoryContext || []).slice(0, 3).map((item) => {
    return `- ${item.citation?.label || item.metadata?.source_path || "memory"}: ${String(item.text || "").slice(0, 180)}`;
  });
  const citations = [];
  for (const result of request.toolResults || []) {
    for (const citation of result.citations || []) {
      citations.push(`- [${citation.id}] ${citation.title} - ${citation.url}`);
    }
  }
  return [...citations, ...memory].join("\n");
}

function buildCaveats(request) {
  const caveats = [];
  if (request.runtimeProfile) caveats.push(`runtime_profile: ${request.runtimeProfile.id} mode uses ${request.runtimeProfile.verificationLevel} verification and ${request.runtimeProfile.responseDepth} response depth.`);
  if (request.modelMeshRoute) caveats.push(`model_mesh: routed through ${request.modelMeshRoute.primaryRole} with ${request.modelMeshRoute.supportRoles.join(", ")} support.`);
  if (request.contextBudget?.pressure?.level && request.contextBudget.pressure.level !== "low") {
    caveats.push(`context_budget: ${request.contextBudget.pressure.level} pressure; ${request.contextBudget.recommendations.join(" ")}`);
  }
  if (request.taskType === "research" && request.toolResults?.some((result) => result.pendingApproval)) {
    caveats.push("Research is waiting on approval before live web sources can be fetched.");
  }
  if (request.taskType === "research" && request.toolResults?.some((result) => result.provider === "none")) {
    caveats.push("No web search provider is configured, so live research cannot be precise yet.");
  }
  for (const risk of request.reasoningFrame?.risks || []) caveats.push(`${risk.kind}: ${risk.mitigation}`);
  const suspicious = (request.toolResults || [])
    .flatMap((result) => result.citations || [])
    .filter((citation) => citation.injection?.suspicious);
  if (suspicious.length) caveats.push(`${suspicious.length} fetched source(s) contained prompt-injection signals and were treated only as untrusted evidence.`);
  for (const check of request.verificationReport?.checks || []) {
    if (check.status !== "ok") caveats.push(`${check.id}: ${check.message}`);
  }
  return caveats.map((item) => `- ${item}`).join("\n");
}

function buildNextSteps(request) {
  if (request.toolResults?.some((result) => result.pendingApproval)) {
    return "Approve or deny the queued action in the terminal prompt or the web console Approvals tab.";
  }
  if (request.taskType === "research" && !request.toolResults?.some((result) => result.ok && result.citations?.length)) {
    return "Configure BRAVE_SEARCH_API_KEY or TAVILY_API_KEY for source-backed web answers.";
  }
  return "";
}

function section(title, body) {
  return `**${title}**\n${body}`;
}

function formatVerification(report) {
  if (!report) return "";
  return [
    `${report.status.toUpperCase()} - ${report.confidence} confidence - ${report.summary}`,
    ...(report.notes || []).map((note) => `- ${note}`)
  ].join("\n");
}

function limitBlock(value, limit) {
  const text = String(value || "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n... truncated ${text.length - limit} chars`;
}
