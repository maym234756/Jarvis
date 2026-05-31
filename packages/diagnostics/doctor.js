import fs from "node:fs";
import path from "node:path";
import { getProviderStatus } from "../config/env.js";

export async function runDoctor({ projectRoot = process.cwd(), memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner, preferenceStore, repoIntelligence, feedbackStore, environmentInspector, eventBus, policyStore, workflowStateStore, artifactStore, riskScorer, policyDecisionPoint, runLedger, backendSupervisor } = {}) {
  const checks = [];
  const providers = getProviderStatus();

  checks.push(check("Node.js", true, `Running ${process.version}`));
  checks.push(check("Workspace", await exists(projectRoot), projectRoot));
  checks.push(check(".env", await exists(path.join(projectRoot, ".env")), "Optional, used for model and search provider keys.", "warn"));
  checks.push(check("Model provider", providers.ollama.configured || providers.openai.enabled, providerMessage(providers), "warn"));
  checks.push(check("Search provider", providers.search.configured, providers.search.configured ? providers.search.provider : "Set DUCKDUCKGO_SEARCH_FALLBACK=true for Jarvis keyless search.", "warn"));
  checks.push(check("Embeddings", true, providers.openaiEmbeddings.enabled ? providers.openaiEmbeddings.model : "Using Jarvis local hash embeddings."));
  checks.push(check("Web console", await exists(path.join(projectRoot, "apps", "web-console", "index.html")), "Served by npm run console.", "warn"));

  if (memoryStore) {
    const stats = await memoryStore.stats();
    checks.push(check("Memory index", stats.chunks > 0, `${stats.chunks} chunk(s), ${stats.sources} source(s), ${stats.tokens} token(s).`, stats.chunks > 0 ? "ok" : "warn"));
  }

  if (toolRegistry) {
    checks.push(check("Tool registry", toolRegistry.listTools().length > 0, `${toolRegistry.listTools().length} tool(s) registered.`));
    if (toolRegistry.approvalQueue) {
      const pending = await toolRegistry.approvalQueue.list({ status: "pending" });
      checks.push(check("Approval queue", true, `${pending.length} pending approval(s).`));
    }
  }

  if (runStore) {
    const stats = await runStore.stats();
    checks.push(check("Run history", true, `${stats.total} run(s), ${stats.failed} failed.`));
  }

  if (sessionStore) {
    const sessions = await sessionStore.listSessions({ limit: 1000 });
    checks.push(check("Sessions", true, `${sessions.length} saved session(s).`));
  }

  if (preferenceStore) {
    const stats = await preferenceStore.stats();
    checks.push(check("User preferences", true, `${stats.active} active preference(s), ${stats.expired} expired.`));
  }

  if (repoIntelligence) {
    const map = await repoIntelligence.buildMap({ maxFiles: 250 });
    checks.push(check("Repository intelligence", map.summary.files > 0, `${map.summary.files} mapped file(s), ${map.symbols.length} symbol(s).`, map.summary.files > 0 ? "ok" : "warn"));
  }

  if (environmentInspector) {
    const environment = await environmentInspector.inspect();
    checks.push(check("Environment", true, `${environment.os.platform}/${environment.os.arch}, package manager ${environment.packageManager || "unknown"}, git changed files ${environment.git.changed ?? "n/a"}.`));
  }

  if (feedbackStore) {
    const feedback = await feedbackStore.summary();
    checks.push(check("Feedback learning loop", true, `${feedback.total} event(s), success rate ${feedback.successRate ?? "n/a"}.`));
  }

  if (eventBus) {
    const events = await eventBus.summary();
    checks.push(check("Event bus", true, `${events.total} event(s), ${Object.keys(events.byType).length} event type(s).`));
  }

  if (policyStore) {
    const policy = await policyStore.status();
    checks.push(check("Policy-as-code", true, `Network default ${policy.networkDefault}, ${policy.blockedShellPatterns} blocked shell pattern(s).`));
  }

  if (riskScorer) {
    const risk = riskScorer.scoreAction({ action: "npm install package", command: "npm install package" });
    checks.push(check("Risk scorer", risk.approvalRequired, `${risk.level} risk (${risk.score}/100) for package install preflight.`, risk.approvalRequired ? "ok" : "warn"));
  }

  if (policyDecisionPoint) {
    const decision = await policyDecisionPoint.decide({ action: "download https://example.com/file.zip", networkTarget: "https://example.com/file.zip" });
    checks.push(check("Policy decision point", decision.requiresApproval || decision.decision === "deny", `${decision.decision}: ${decision.reason}`, decision.requiresApproval || decision.decision === "deny" ? "ok" : "warn"));
  }

  if (workflowStateStore) {
    const workflowState = await workflowStateStore.summary();
    checks.push(check("Workflow state", true, `${workflowState.total} workflow state record(s).`));
  }

  if (artifactStore) {
    const artifacts = await artifactStore.summary();
    checks.push(check("Artifacts", true, `${artifacts.total} artifact(s).`));
  }

  if (runLedger) {
    const ledger = await runLedger.summary();
    checks.push(check("Run ledger", true, `${ledger.total} replayable run ledger record(s).`));
  }

  if (backendSupervisor) {
    const readiness = await backendSupervisor.readiness();
    checks.push(check(
      "Backend supervisor",
      readiness.ok,
      `${readiness.status}: ${readiness.summary.requiredReady}/${readiness.summary.required} required service(s) ready, ${readiness.summary.requiredErrors} blocking issue(s).`,
      readiness.ok ? "ok" : "fail"
    ));
  }

  if (dockingStation) {
    const report = await dockingStation.report();
    checks.push(check(
      "Backend docking station",
      report.summary.error === 0,
      `${report.summary.total} dock(s), ${report.summary.ok} ok, ${report.summary.warn} warning(s).`,
      report.summary.error === 0 ? "ok" : "fail"
    ));
  }

  if (evalRunner) {
    const evals = await evalRunner.run();
    checks.push(check("Backend evals", evals.ok, evals.summary, evals.ok ? "ok" : "fail"));
  }

  const failed = checks.filter((item) => item.status === "fail").length;
  const warnings = checks.filter((item) => item.status === "warn").length;
  return {
    ok: failed === 0,
    summary: failed ? `${failed} failed check(s), ${warnings} warning(s).` : `${warnings} warning(s), no failed checks.`,
    providers,
    checks
  };
}

export function formatDoctorReport(report) {
  return [
    `Jarvis doctor: ${report.summary}`,
    ...report.checks.map((item) => {
      const marker = item.status === "ok" ? "OK" : item.status === "warn" ? "WARN" : "FAIL";
      return `[${marker}] ${item.name}: ${item.message}`;
    })
  ].join("\n");
}

function check(name, passed, message, severity = "fail") {
  return {
    name,
    status: passed ? "ok" : severity,
    message
  };
}

async function exists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function providerMessage(providers) {
  if (providers.ollama.configured) return `Jarvis local model ${providers.ollama.model}`;
  if (providers.openai.enabled) return `Optional hosted connector enabled: ${providers.openai.model}`;
  if (providers.openai.configured) return "Hosted connector is configured but disabled; Jarvis is running local-first.";
  return "Set OLLAMA_BASE_URL to enable Jarvis local model responses.";
}
