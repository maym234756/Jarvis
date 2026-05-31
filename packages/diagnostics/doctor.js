import fs from "node:fs";
import path from "node:path";
import { getProviderStatus } from "../config/env.js";

export async function runDoctor({ projectRoot = process.cwd(), memoryStore, toolRegistry, runStore, sessionStore, dockingStation } = {}) {
  const checks = [];
  const providers = getProviderStatus();

  checks.push(check("Node.js", true, `Running ${process.version}`));
  checks.push(check("Workspace", await exists(projectRoot), projectRoot));
  checks.push(check(".env", await exists(path.join(projectRoot, ".env")), "Optional, used for model and search provider keys.", "warn"));
  checks.push(check("Model provider", providers.openai.configured || providers.ollama.configured, providerMessage(providers), "warn"));
  checks.push(check("Search provider", providers.search.configured, providers.search.configured ? providers.search.provider : "Set BRAVE_SEARCH_API_KEY or TAVILY_API_KEY for live research.", "warn"));
  checks.push(check("Embeddings", true, providers.openaiEmbeddings.configured ? providers.openaiEmbeddings.model : "Using local hash embeddings."));
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

  if (dockingStation) {
    const report = await dockingStation.report();
    checks.push(check(
      "Backend docking station",
      report.summary.error === 0,
      `${report.summary.total} dock(s), ${report.summary.ok} ok, ${report.summary.warn} warning(s).`,
      report.summary.error === 0 ? "ok" : "fail"
    ));
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
  if (providers.openai.configured) return `OpenAI-compatible model ${providers.openai.model}`;
  if (providers.ollama.configured) return `Ollama model ${providers.ollama.model}`;
  return "Set OPENAI_API_KEY or OLLAMA_BASE_URL to enable real model responses.";
}
