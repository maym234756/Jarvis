export class VerificationEngine {
  verify({ message, taskType, plan = [], toolResults = [], memoryContext = [], reasoningFrame, responseMode, runtimeProfile } = {}) {
    const checks = [
      check("plan_present", plan.length > 0, `${plan.length} plan step(s) prepared.`),
      check("reasoning_frame", Boolean(reasoningFrame?.goal), reasoningFrame?.goal ? "Reasoning frame is present." : "Reasoning frame is missing."),
      check("memory_checked", Array.isArray(memoryContext), `${memoryContext.length} memory match(es) considered.`),
      check("tool_failures", !toolResults.some((result) => result.ok === false && !result.pendingApproval), summarizeToolFailures(toolResults)),
      check("pending_approvals", !toolResults.some((result) => result.pendingApproval), summarizePending(toolResults), "warn"),
      check("prompt_injection", suspiciousSourceCount(toolResults) === 0, `${suspiciousSourceCount(toolResults)} suspicious source(s) detected.`, "warn")
    ];

    if (taskType === "research") {
      checks.push(check(
        "research_citations",
        toolResults.some((result) => Array.isArray(result.citations) && result.citations.some((citation) => citation.ok)),
        "Research should include fetched citations when live search is available.",
        "warn"
      ));
    }

    if (taskType === "coding" || taskType === "debug") {
      checks.push(check(
        "coding_verification",
        toolResults.some((result) => result.tool === "shell.run" && result.ok && result.exitCode === 0),
        "Coding/debug work should be verified with a passing command when possible.",
        "warn"
      ));
    }

    const failed = checks.filter((item) => item.status === "fail").length;
    const warnings = checks.filter((item) => item.status === "warn").length;
    const ok = failed === 0;
    return {
      ok,
      status: failed ? "fail" : warnings ? "warn" : "ok",
      confidence: confidenceFor({ failed, warnings, memoryContext, toolResults, runtimeProfile }),
      responseMode: responseMode?.id || responseMode || null,
      runtimeProfile: runtimeProfile?.id || null,
      checks,
      summary: `${checks.length - failed - warnings} ok, ${warnings} warning(s), ${failed} failure(s).`,
      notes: buildNotes({ message, taskType, checks, runtimeProfile })
    };
  }
}

function check(id, passed, message, severity = "fail") {
  return {
    id,
    status: passed ? "ok" : severity,
    message
  };
}

function summarizeToolFailures(toolResults) {
  const failures = toolResults.filter((result) => result.ok === false && !result.pendingApproval);
  if (!failures.length) return "No failed tools.";
  return failures.map((result) => `${result.tool}: ${result.error || result.summary || "failed"}`).join("; ");
}

function summarizePending(toolResults) {
  const pending = toolResults.filter((result) => result.pendingApproval);
  if (!pending.length) return "No pending approvals.";
  return pending.map((result) => `${result.tool}: ${result.reason || result.summary || "pending"}`).join("; ");
}

function suspiciousSourceCount(toolResults) {
  return toolResults
    .flatMap((result) => result.citations || [])
    .filter((citation) => citation.injection?.suspicious).length;
}

function confidenceFor({ failed, warnings, memoryContext, toolResults, runtimeProfile }) {
  if (failed) return "blocked";
  if (warnings >= 2) return "conditional";
  if (toolResults.some((result) => result.ok) || memoryContext.length) return runtimeProfile?.verificationLevel === "strict" ? "verified" : "grounded";
  return "draft";
}

function buildNotes({ taskType, checks, runtimeProfile }) {
  const notes = [];
  if (runtimeProfile) notes.push(`Runtime profile: ${runtimeProfile.id} (${runtimeProfile.verificationLevel} verification).`);
  if (taskType === "research" && checks.some((item) => item.id === "research_citations" && item.status !== "ok")) {
    notes.push("Live research precision depends on configured search providers.");
  }
  if ((taskType === "coding" || taskType === "debug") && checks.some((item) => item.id === "coding_verification" && item.status !== "ok")) {
    notes.push("No passing verification command was observed for this coding/debug task.");
  }
  return notes;
}
