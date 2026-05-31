import fs from "node:fs";
import path from "node:path";
import { getProviderStatus } from "../config/env.js";

export class BackendDockingStation {
  constructor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.memoryStore = memoryStore;
    this.toolRegistry = toolRegistry;
    this.runStore = runStore;
    this.sessionStore = sessionStore;
    this.modelRouter = modelRouter;
    this.reasoningEngine = reasoningEngine;
    this.searchEngine = searchEngine;
    this.workflowEngine = workflowEngine;
    this.metricsStore = metricsStore;
    this.connectorRegistry = connectorRegistry;
    this.evalRunner = evalRunner;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "docking");
    this.reportPath = path.join(this.stateDir, "last-report.json");
  }

  async report() {
    const docks = await this.listDocks();
    const summary = summarizeDocks(docks);
    const report = {
      ok: docks.every((dock) => dock.health !== "error"),
      generated_at: new Date().toISOString(),
      summary,
      docks
    };
    await this.#saveReport(report);
    return report;
  }

  async listDocks() {
    const providers = getProviderStatus();
    const memoryStats = this.memoryStore ? await this.memoryStore.stats() : null;
    const tools = this.toolRegistry ? this.toolRegistry.listTools() : [];
    const approvals = this.toolRegistry?.approvalQueue ? await this.toolRegistry.approvalQueue.list({ status: "pending" }) : [];
    const runStats = this.runStore ? await this.runStore.stats() : null;
    const sessions = this.sessionStore ? await this.sessionStore.listSessions({ limit: 1000 }) : [];
    const connectorStatus = this.connectorRegistry ? await this.connectorRegistry.status() : null;
    const port = Number(process.env.JARVIS_PORT || 8787);

    return [
      dock({
        id: "runtime.node",
        name: "Node.js Runtime",
        type: "runtime",
        status: "online",
        health: "ok",
        capabilities: ["javascript-runtime", "built-in-fetch", "node-test"],
        details: { version: process.version }
      }),
      dock({
        id: "core.api",
        name: "Jarvis API Server",
        type: "core",
        status: "local",
        health: "ok",
        endpoint: `http://localhost:${port}`,
        capabilities: ["chat", "tools", "approvals", "memory", "sessions", "runs", "docking"]
      }),
      dock({
        id: "core.web-console",
        name: "Jarvis Web Console",
        type: "core",
        status: await exists(path.join(this.projectRoot, "apps", "web-console", "index.html")) ? "available" : "missing",
        health: await exists(path.join(this.projectRoot, "apps", "web-console", "index.html")) ? "ok" : "warn",
        endpoint: `http://localhost:${port}`,
        capabilities: ["chat-ui", "approval-ui", "memory-ui", "ops-ui", "docking-ui"]
      }),
      dock({
        id: "engine.reasoning",
        name: "Reasoning Engine",
        type: "engine",
        status: this.reasoningEngine ? "online" : "offline",
        health: this.reasoningEngine ? "ok" : "warn",
        capabilities: ["task-traits", "evidence-needs", "risk-notes", "answer-contracts", "logic-graph"]
      }),
      dock({
        id: "engine.search",
        name: "Search Engine",
        type: "engine",
        status: this.searchEngine ? "online" : "offline",
        health: this.searchEngine ? "ok" : "warn",
        capabilities: ["query-planning", "dedupe", "source-ranking", "source-fetch", "snippet-extraction", "citations", "cache"],
        details: this.searchEngine?.cacheStatus ? this.searchEngine.cacheStatus() : {}
      }),
      dock({
        id: "context.compaction",
        name: "Context Compaction",
        type: "engine",
        status: this.sessionStore?.contextCompactor ? "online" : "offline",
        health: this.sessionStore?.contextCompactor ? "ok" : "warn",
        capabilities: ["long-session-summary", "recent-turn-retention", "prompt-budgeting"],
        details: this.sessionStore?.contextCompactor
          ? {
            maxMessages: this.sessionStore.contextCompactor.maxMessages,
            keepMessages: this.sessionStore.contextCompactor.keepMessages,
            maxSummaryChars: this.sessionStore.contextCompactor.maxSummaryChars
          }
          : {}
      }),
      dock({
        id: "engine.workflow",
        name: "Workflow Engine",
        type: "engine",
        status: this.workflowEngine ? "online" : "offline",
        health: this.workflowEngine ? "ok" : "warn",
        capabilities: this.workflowEngine?.list ? this.workflowEngine.list().map((workflow) => workflow.name) : []
      }),
      dock({
        id: "model.router",
        name: "Model Router",
        type: "model",
        status: this.modelRouter ? "online" : "offline",
        health: this.modelRouter ? "ok" : "warn",
        capabilities: ["privacy-routing", "hosted-models", "local-models", "fallback-local-draft"],
        details: this.modelRouter?.describe ? this.modelRouter.describe({ privacyLevel: "project" }) : {}
      }),
      dock({
        id: "model.openai",
        name: "OpenAI-Compatible Chat Model",
        type: "model",
        configured: providers.openai.configured,
        status: providers.openai.configured ? "configured" : "not_configured",
        health: providers.openai.configured ? "ok" : "warn",
        endpoint: providers.openai.baseUrl,
        configKeys: ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL"],
        capabilities: ["chat-completions", "reasoning"],
        guidance: "Set OPENAI_API_KEY and OPENAI_MODEL in .env to use a hosted OpenAI-compatible model.",
        details: { model: providers.openai.model }
      }),
      dock({
        id: "model.ollama",
        name: "Ollama Local Model",
        type: "model",
        configured: providers.ollama.configured,
        status: providers.ollama.configured ? "configured" : "not_configured",
        health: providers.ollama.configured ? "ok" : "warn",
        endpoint: providers.ollama.baseUrl,
        configKeys: ["OLLAMA_BASE_URL", "OLLAMA_MODEL"],
        capabilities: ["local-chat", "private-inference"],
        guidance: "Set OLLAMA_BASE_URL and OLLAMA_MODEL in .env to use local inference.",
        details: { model: providers.ollama.model }
      }),
      dock({
        id: "embeddings.local",
        name: "Local Hash Embeddings",
        type: "embeddings",
        configured: true,
        status: "online",
        health: "ok",
        capabilities: ["offline-embeddings", "memory-retrieval"],
        details: { model: "local-hash-v1" }
      }),
      dock({
        id: "embeddings.openai",
        name: "OpenAI-Compatible Embeddings",
        type: "embeddings",
        configured: providers.openaiEmbeddings.configured,
        status: providers.openaiEmbeddings.configured ? "configured" : "not_configured",
        health: providers.openaiEmbeddings.configured ? "ok" : "warn",
        endpoint: providers.openai.baseUrl,
        configKeys: ["OPENAI_API_KEY", "OPENAI_EMBEDDING_MODEL"],
        capabilities: ["hosted-embeddings"],
        guidance: "Set OPENAI_EMBEDDING_MODEL when you want hosted embeddings instead of local hash embeddings.",
        details: { model: providers.openaiEmbeddings.model }
      }),
      dock({
        id: "search.brave",
        name: "Brave Search",
        type: "search",
        configured: Boolean(process.env.BRAVE_SEARCH_API_KEY),
        status: process.env.BRAVE_SEARCH_API_KEY ? "configured" : "not_configured",
        health: process.env.BRAVE_SEARCH_API_KEY ? "ok" : "warn",
        endpoint: "https://api.search.brave.com",
        configKeys: ["BRAVE_SEARCH_API_KEY"],
        capabilities: ["web-search", "research"],
        guidance: "Set BRAVE_SEARCH_API_KEY to enable live web research."
      }),
      dock({
        id: "search.tavily",
        name: "Tavily Search",
        type: "search",
        configured: Boolean(process.env.TAVILY_API_KEY),
        status: process.env.TAVILY_API_KEY ? "configured" : "not_configured",
        health: process.env.TAVILY_API_KEY ? "ok" : "warn",
        endpoint: "https://api.tavily.com",
        configKeys: ["TAVILY_API_KEY"],
        capabilities: ["web-search", "research"],
        guidance: "Set TAVILY_API_KEY to enable live web research."
      }),
      dock({
        id: "memory.local-jsonl",
        name: "Local Memory Store",
        type: "memory",
        status: memoryStats ? "online" : "unavailable",
        health: memoryStats ? "ok" : "warn",
        endpoint: memoryStats?.indexPath || path.join(this.projectRoot, ".jarvis", "memory", "chunks.jsonl"),
        capabilities: ["chunking", "citations", "local-embeddings", "metadata-filters", "rebuild", "compact"],
        details: memoryStats || {}
      }),
      dock({
        id: "metrics.local-jsonl",
        name: "Metrics Store",
        type: "state",
        status: this.metricsStore ? "online" : "offline",
        health: this.metricsStore ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "metrics", "events.jsonl"),
        capabilities: ["tool-duration", "event-summary", "backend-performance"],
        details: this.metricsStore ? await this.metricsStore.summary() : {}
      }),
      dock({
        id: "connectors.registry",
        name: "Connector Registry",
        type: "connectors",
        status: this.connectorRegistry ? "online" : "offline",
        health: this.connectorRegistry ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "connectors", "connectors.json"),
        capabilities: ["mcp-style-connectors", "endpoint-health", "permission-policy", "tool-filters"],
        details: connectorStatus || {}
      }),
      dock({
        id: "evals.backend",
        name: "Backend Evals",
        type: "quality",
        status: this.evalRunner ? "available" : "offline",
        health: this.evalRunner ? "ok" : "warn",
        capabilities: ["tool-routing-evals", "safety-evals", "context-evals", "runtime-regression-checks"],
        guidance: this.evalRunner ? null : "Configure the eval runner to run backend quality checks."
      }),
      dock({
        id: "tools.registry",
        name: "Tool Registry",
        type: "tools",
        status: tools.length ? "online" : "empty",
        health: tools.length ? "ok" : "warn",
        capabilities: tools.map((tool) => tool.name),
        details: { count: tools.length }
      }),
      dock({
        id: "approvals.local-queue",
        name: "Approval Queue",
        type: "safety",
        status: "online",
        health: "ok",
        endpoint: path.join(this.projectRoot, ".jarvis", "approvals", "queue.json"),
        capabilities: ["permission-gating", "api-approval", "audit"],
        details: { pending: approvals.length }
      }),
      dock({
        id: "sessions.local-json",
        name: "Session Store",
        type: "state",
        status: "online",
        health: "ok",
        endpoint: path.join(this.projectRoot, ".jarvis", "sessions"),
        capabilities: ["chat-history", "session-resume"],
        details: { count: sessions.length }
      }),
      dock({
        id: "runs.local-jsonl",
        name: "Run History",
        type: "state",
        status: "online",
        health: "ok",
        endpoint: path.join(this.projectRoot, ".jarvis", "runs", "runs.jsonl"),
        capabilities: ["run-tracking", "task-history", "failure-audit"],
        details: runStats || {}
      })
    ];
  }

  async testDock(id) {
    const docks = await this.listDocks();
    const target = docks.find((item) => item.id === id);
    if (!target) throw new Error(`Unknown dock: ${id}`);

    if (!target.configured && ["model", "search", "embeddings"].includes(target.type) && id !== "embeddings.local") {
      return {
        ok: false,
        id,
        status: "not_configured",
        message: target.guidance || "Dock is not configured."
      };
    }

    if (id.startsWith("engine.") || id === "model.router") return { ok: target.health === "ok", id, status: target.status, message: `${target.name} is ${target.status}.` };
    if (id === "model.ollama") return testOllama(target);
    if (id === "model.openai") return testOpenAI(target);
    if (id === "embeddings.openai") return testOpenAIEmbeddings(target);
    if (id === "search.brave") return testBraveSearch();
    if (id === "search.tavily") return testTavilySearch();
    if (id === "memory.local-jsonl") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.chunks || 0} chunk(s) available.` };
    if (id === "metrics.local-jsonl") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.totalEvents || 0} metric event(s) recorded.` };
    if (id === "connectors.registry") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.count || 0} connector(s), ${target.details.enabled || 0} enabled.` };
    if (id === "evals.backend" && this.evalRunner) {
      const result = await this.evalRunner.run();
      return { ok: result.ok, id, status: result.ok ? "passing" : "failing", message: result.summary, result };
    }
    if (id === "tools.registry") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.count || 0} tool(s) registered.` };
    return { ok: target.health !== "error", id, status: target.status, message: `${target.name} is ${target.status}.` };
  }

  async #saveReport(report) {
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.writeFile(this.reportPath, JSON.stringify(report, null, 2), "utf8");
  }
}

export function formatDockReport(report) {
  const lines = [
    `Backend Docking Station: ${report.summary.ok} ok, ${report.summary.warn} warning, ${report.summary.error} error`
  ];
  for (const dock of report.docks) {
    const marker = dock.health === "ok" ? "OK" : dock.health === "warn" ? "WARN" : "ERROR";
    lines.push(`[${marker}] ${dock.id} - ${dock.name} (${dock.status})`);
    if (dock.guidance && dock.health !== "ok") lines.push(`  ${dock.guidance}`);
  }
  return lines.join("\n");
}

function dock(input) {
  return {
    configured: true,
    status: "unknown",
    health: "warn",
    endpoint: null,
    configKeys: [],
    capabilities: [],
    guidance: null,
    details: {},
    ...input
  };
}

function summarizeDocks(docks) {
  return {
    total: docks.length,
    ok: docks.filter((dock) => dock.health === "ok").length,
    warn: docks.filter((dock) => dock.health === "warn").length,
    error: docks.filter((dock) => dock.health === "error").length,
    configured: docks.filter((dock) => dock.configured).length,
    notConfigured: docks.filter((dock) => !dock.configured).length
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

async function testOllama(target) {
  const data = await fetchJson(`${target.endpoint}/api/tags`, { timeoutMs: 5000 });
  return {
    ok: true,
    id: target.id,
    status: "online",
    message: `${data.models?.length || 0} Ollama model(s) available.`
  };
}

async function testOpenAI(target) {
  const data = await fetchJson(`${target.endpoint}/models`, {
    timeoutMs: 8000,
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
  });
  return {
    ok: true,
    id: target.id,
    status: "online",
    message: `${data.data?.length || 0} model(s) visible.`
  };
}

async function testOpenAIEmbeddings(target) {
  const baseUrl = target.endpoint || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const data = await fetchJson(`${baseUrl}/embeddings`, {
    method: "POST",
    timeoutMs: 8000,
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL,
      input: "Jarvis docking test"
    })
  });
  return {
    ok: Boolean(data.data?.[0]?.embedding),
    id: target.id,
    status: "online",
    message: `Embedding dimensions: ${data.data?.[0]?.embedding?.length || 0}.`
  };
}

async function testBraveSearch() {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", "Jarvis docking test");
  url.searchParams.set("count", "1");
  const data = await fetchJson(url, {
    timeoutMs: 8000,
    headers: {
      accept: "application/json",
      "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY
    }
  });
  return {
    ok: true,
    id: "search.brave",
    status: "online",
    message: `${data.web?.results?.length || 0} result(s) returned.`
  };
}

async function testTavilySearch() {
  const data = await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    timeoutMs: 8000,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: "Jarvis docking test",
      max_results: 1
    })
  });
  return {
    ok: true,
    id: "search.tavily",
    status: "online",
    message: `${data.results?.length || 0} result(s) returned.`
  };
}

async function fetchJson(url, { timeoutMs = 5000, ...options } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
    return body ? JSON.parse(body) : {};
  } finally {
    clearTimeout(timeout);
  }
}
