import fs from "node:fs";
import path from "node:path";
import { getProviderStatus } from "../config/env.js";
import { listRuntimeProfiles } from "../runtime/index.js";

export class BackendDockingStation {
  constructor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger } = {}) {
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
    this.preferenceStore = preferenceStore;
    this.repoIntelligence = repoIntelligence;
    this.verificationEngine = verificationEngine;
    this.contextBudgetManager = contextBudgetManager;
    this.environmentInspector = environmentInspector;
    this.capabilityBus = capabilityBus;
    this.feedbackStore = feedbackStore;
    this.modelMesh = modelMesh;
    this.eventBus = eventBus;
    this.policyStore = policyStore;
    this.workflowStateStore = workflowStateStore;
    this.artifactStore = artifactStore;
    this.controlPlane = controlPlane;
    this.riskScorer = riskScorer;
    this.policyDecisionPoint = policyDecisionPoint;
    this.runLedger = runLedger;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "docking");
    this.reportPath = path.join(this.stateDir, "last-report.json");
  }

  setBackendSupervisor(backendSupervisor) {
    this.backendSupervisor = backendSupervisor;
    return this;
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
    const accountConnectors = this.connectorRegistry?.discoverAccountConnectors ? this.connectorRegistry.discoverAccountConnectors() : [];
    const preferenceStats = this.preferenceStore ? await this.preferenceStore.stats() : null;
    const repoMap = this.repoIntelligence ? await this.repoIntelligence.buildMap({ maxFiles: 250 }) : null;
    const feedbackSummary = this.feedbackStore ? await this.feedbackStore.summary() : null;
    const environment = this.environmentInspector ? await this.environmentInspector.inspect() : null;
    const eventSummary = this.eventBus ? await this.eventBus.summary() : null;
    const policyStatus = this.policyStore ? await this.policyStore.status() : null;
    const riskSample = this.riskScorer ? this.riskScorer.scoreAction({ action: "npm install package", command: "npm install package" }) : null;
    const policyDecisionSample = this.policyDecisionPoint ? await this.policyDecisionPoint.decide({ action: "download https://example.com/file.zip", networkTarget: "https://example.com/file.zip" }) : null;
    const workflowStateSummary = this.workflowStateStore ? await this.workflowStateStore.summary() : null;
    const artifactSummary = this.artifactStore ? await this.artifactStore.summary() : null;
    const runLedgerSummary = this.runLedger ? await this.runLedger.summary() : null;
    const backendReadiness = this.backendSupervisor ? await this.backendSupervisor.readiness() : null;
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
        id: "engine.verification",
        name: "Verification Engine",
        type: "engine",
        status: this.verificationEngine ? "online" : "offline",
        health: this.verificationEngine ? "ok" : "warn",
        capabilities: ["plan-checks", "tool-result-checks", "citation-checks", "coding-verification-notes", "confidence-labels"]
      }),
      dock({
        id: "runtime.profiles",
        name: "Runtime Profiles",
        type: "runtime",
        status: "available",
        health: "ok",
        capabilities: listRuntimeProfiles().map((profile) => profile.id),
        details: { profiles: listRuntimeProfiles() }
      }),
      dock({
        id: "runtime.environment",
        name: "Environment Inspector",
        type: "runtime",
        status: this.environmentInspector ? "online" : "offline",
        health: this.environmentInspector ? "ok" : "warn",
        capabilities: ["os-detection", "shell-detection", "package-manager", "git-status", "resource-summary"],
        details: environment ? { os: environment.os, packageManager: environment.packageManager, git: environment.git, resources: environment.resources } : {}
      }),
      dock({
        id: "control.plane",
        name: "AI Control Plane",
        type: "core",
        status: this.controlPlane ? "online" : "offline",
        health: this.controlPlane ? "ok" : "warn",
        capabilities: ["intent-routing", "workflow-selection", "model-route-preview", "tool-scope", "policy-context", "context-budget"]
      }),
      dock({
        id: "backend.supervisor",
        name: "Backend Supervisor",
        type: "core",
        status: this.backendSupervisor ? backendReadiness.status : "offline",
        health: this.backendSupervisor ? backendReadiness.ok ? "ok" : "error" : "warn",
        endpoint: `http://localhost:${port}/backend`,
        capabilities: ["readiness", "service-topology", "dependency-graph", "wiring-checks"],
        details: backendReadiness || {}
      }),
      dock({
        id: "events.local-jsonl",
        name: "Event Bus",
        type: "observability",
        status: this.eventBus ? "online" : "offline",
        health: this.eventBus ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "events", "events.jsonl"),
        capabilities: ["event-log", "workflow-events", "tool-events", "observability"],
        details: eventSummary || {}
      }),
      dock({
        id: "policy.local-json",
        name: "Policy-As-Code",
        type: "safety",
        status: this.policyStore ? "online" : "offline",
        health: this.policyStore ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "policy", "policy.json"),
        capabilities: ["network-policy", "shell-policy", "file-policy", "secret-policy"],
        details: policyStatus || {}
      }),
      dock({
        id: "policy.decision-point",
        name: "Policy Decision Point",
        type: "safety",
        status: this.policyDecisionPoint ? "online" : "offline",
        health: this.policyDecisionPoint ? "ok" : "warn",
        capabilities: ["allow-deny-approval", "sandbox-routing", "policy-preflight"],
        details: policyDecisionSample || {}
      }),
      dock({
        id: "risk.scorer",
        name: "Risk Scorer",
        type: "safety",
        status: this.riskScorer ? "online" : "offline",
        health: this.riskScorer ? "ok" : "warn",
        capabilities: ["step-risk", "plan-risk", "approval-thresholds", "failure-taxonomy"],
        details: riskSample || {}
      }),
      dock({
        id: "context.budget",
        name: "Context Budget Manager",
        type: "context",
        status: this.contextBudgetManager ? "online" : "offline",
        health: this.contextBudgetManager ? "ok" : "warn",
        capabilities: ["token-budgeting", "context-pressure", "compression-recommendations"]
      }),
      dock({
        id: "model.mesh",
        name: "Model Mesh Router",
        type: "model",
        status: this.modelMesh ? "online" : "offline",
        health: this.modelMesh ? "ok" : "warn",
        capabilities: this.modelMesh ? this.modelMesh.listRoles().map((role) => role.id) : []
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
        capabilities: ["local-first-routing", "optional-provider-connectors", "privacy-routing", "fallback-local-draft"],
        details: this.modelRouter?.describe ? this.modelRouter.describe({ privacyLevel: "project" }) : {}
      }),
      dock({
        id: "model.openai",
        name: "OpenAI-Compatible Optional Connector",
        type: "model",
        optional: true,
        configured: providers.openai.configured,
        status: providers.openai.configured ? providers.openai.enabled ? "connector_enabled" : "connector_configured_disabled" : "optional",
        health: "ok",
        endpoint: providers.openai.baseUrl,
        configKeys: ["JARVIS_ALLOW_HOSTED_PROVIDERS", "JARVIS_MODEL_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL"],
        capabilities: ["optional-hosted-connector", "chat-completions"],
        guidance: "Optional connector only. Jarvis stays local-first unless JARVIS_ALLOW_HOSTED_PROVIDERS=true and JARVIS_MODEL_PROVIDER=openai.",
        details: { model: providers.openai.model, enabled: providers.openai.enabled }
      }),
      dock({
        id: "model.ollama",
        name: "Jarvis Local Model",
        type: "model",
        configured: providers.ollama.configured,
        status: providers.ollama.configured ? "configured" : "not_configured",
        health: providers.ollama.configured ? "ok" : "warn",
        endpoint: providers.ollama.baseUrl,
        configKeys: ["OLLAMA_BASE_URL", "OLLAMA_MODEL"],
        capabilities: ["jarvis-local-chat", "private-inference"],
        guidance: "Set OLLAMA_BASE_URL and OLLAMA_MODEL in .env so Jarvis can run its local model.",
        details: { model: providers.ollama.model, runtime: "ollama" }
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
        name: "OpenAI-Compatible Optional Embeddings Connector",
        type: "embeddings",
        optional: true,
        configured: providers.openaiEmbeddings.configured,
        status: providers.openaiEmbeddings.configured ? providers.openaiEmbeddings.enabled ? "connector_enabled" : "connector_configured_disabled" : "optional",
        health: "ok",
        endpoint: providers.openai.baseUrl,
        configKeys: ["JARVIS_ALLOW_HOSTED_PROVIDERS", "OPENAI_API_KEY", "OPENAI_EMBEDDING_MODEL"],
        capabilities: ["optional-hosted-embeddings"],
        guidance: "Optional connector only. Jarvis uses local hash embeddings by default.",
        details: { model: providers.openaiEmbeddings.model, enabled: providers.openaiEmbeddings.enabled }
      }),
      dock({
        id: "search.brave",
        name: "Brave Optional Search Connector",
        type: "search",
        optional: true,
        configured: Boolean(process.env.BRAVE_SEARCH_API_KEY),
        status: process.env.BRAVE_SEARCH_API_KEY ? "connector_configured" : "optional",
        health: "ok",
        endpoint: "https://api.search.brave.com",
        configKeys: ["BRAVE_SEARCH_API_KEY"],
        capabilities: ["optional-search-connector", "web-search", "research"],
        guidance: "Optional connector. Jarvis can use DuckDuckGo fallback without this key."
      }),
      dock({
        id: "search.tavily",
        name: "Tavily Optional Search Connector",
        type: "search",
        optional: true,
        configured: Boolean(process.env.TAVILY_API_KEY),
        status: process.env.TAVILY_API_KEY ? "connector_configured" : "optional",
        health: "ok",
        endpoint: "https://api.tavily.com",
        configKeys: ["TAVILY_API_KEY"],
        capabilities: ["optional-search-connector", "web-search", "research"],
        guidance: "Optional connector. Jarvis can use DuckDuckGo fallback without this key."
      }),
      dock({
        id: "search.duckduckgo",
        name: "DuckDuckGo Fallback Search",
        type: "search",
        configured: /^(1|true|yes)$/i.test(process.env.DUCKDUCKGO_SEARCH_FALLBACK || ""),
        status: /^(1|true|yes)$/i.test(process.env.DUCKDUCKGO_SEARCH_FALLBACK || "") ? "configured" : "not_configured",
        health: /^(1|true|yes)$/i.test(process.env.DUCKDUCKGO_SEARCH_FALLBACK || "") ? "ok" : "warn",
        endpoint: "https://api.duckduckgo.com",
        configKeys: ["DUCKDUCKGO_SEARCH_FALLBACK"],
        capabilities: ["keyless-search", "instant-answer-search", "research-fallback"],
        guidance: "Set DUCKDUCKGO_SEARCH_FALLBACK=true for Jarvis keyless fallback search."
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
        capabilities: ["mcp-style-connectors", "endpoint-health", "permission-policy", "tool-filters", "account-connectors"],
        details: connectorStatus ? { ...connectorStatus, accountConnectors } : { accountConnectors }
      }),
      dock({
        id: "connector.salesforce",
        name: "Salesforce Account Connector",
        type: "connectors",
        optional: true,
        configured: Boolean(process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN),
        status: process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN ? "configured" : "optional",
        health: "ok",
        configKeys: ["SALESFORCE_INSTANCE_URL", "SALESFORCE_ACCESS_TOKEN", "SALESFORCE_API_VERSION"],
        capabilities: ["crm-account", "soql-read-only", "object-describe", "user-permission-scoped"],
        guidance: "Optional account connector. Salesforce itself enforces the authenticated user's object permissions, field-level security, and sharing rules.",
        details: accountConnectors.find((item) => item.id === "salesforce") || {}
      }),
      dock({
        id: "capabilities.bus",
        name: "Capability Bus",
        type: "tools",
        status: this.capabilityBus ? "online" : "offline",
        health: this.capabilityBus ? "ok" : "warn",
        capabilities: ["tool-contracts", "capability-search", "simulation", "risk-preview"],
        details: { contracts: this.capabilityBus ? this.capabilityBus.listCapabilities().length : 0 }
      }),
      dock({
        id: "preferences.local-json",
        name: "User Preference Store",
        type: "memory",
        status: this.preferenceStore ? "online" : "offline",
        health: this.preferenceStore ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "preferences", "user.json"),
        capabilities: ["user-preferences", "confidence", "expiration", "garbage-collection", "sensitivity-labels"],
        details: preferenceStats || {}
      }),
      dock({
        id: "repo.intelligence",
        name: "Repository Intelligence",
        type: "code",
        status: this.repoIntelligence ? "online" : "offline",
        health: this.repoIntelligence ? "ok" : "warn",
        capabilities: ["file-map", "symbol-index", "package-scripts", "test-map", "language-summary"],
        details: repoMap ? { summary: repoMap.summary, tests: repoMap.tests.scripts, languages: repoMap.languages } : {}
      }),
      dock({
        id: "workflow.state",
        name: "Workflow State Store",
        type: "state",
        status: this.workflowStateStore ? "online" : "offline",
        health: this.workflowStateStore ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "workflow-state"),
        capabilities: ["agent-state", "pause-resume-foundation", "state-transitions", "audit"],
        details: workflowStateSummary || {}
      }),
      dock({
        id: "run.ledger",
        name: "Replayable Run Ledger",
        type: "state",
        status: this.runLedger ? "online" : "offline",
        health: this.runLedger ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "run-ledger", "runs.jsonl"),
        capabilities: ["run-ledger", "replay", "failure-analysis", "audit"],
        details: runLedgerSummary || {}
      }),
      dock({
        id: "artifacts.local-store",
        name: "Artifact Store",
        type: "state",
        status: this.artifactStore ? "online" : "offline",
        health: this.artifactStore ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "artifacts"),
        capabilities: ["reports", "logs", "generated-outputs", "artifact-metadata"],
        details: artifactSummary || {}
      }),
      dock({
        id: "learning.feedback",
        name: "Feedback Learning Loop",
        type: "quality",
        status: this.feedbackStore ? "online" : "offline",
        health: this.feedbackStore ? "ok" : "warn",
        endpoint: path.join(this.projectRoot, ".jarvis", "feedback", "events.jsonl"),
        capabilities: ["outcome-tracking", "route-feedback", "user-feedback", "success-rate"],
        details: feedbackSummary || {}
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

    if (target.optional && /disabled/.test(target.status)) {
      return {
        ok: true,
        id,
        status: target.status,
        message: target.guidance || "Optional connector is configured but disabled by Jarvis local-first policy."
      };
    }

    if (!target.configured && target.optional) {
      return {
        ok: true,
        id,
        status: target.status,
        message: target.guidance || "Optional connector is not configured; Jarvis core does not require it."
      };
    }

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
    if (id === "search.duckduckgo") return testDuckDuckGoSearch();
    if (id === "memory.local-jsonl") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.chunks || 0} chunk(s) available.` };
    if (id === "metrics.local-jsonl") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.totalEvents || 0} metric event(s) recorded.` };
    if (id === "connectors.registry") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.count || 0} connector(s), ${target.details.enabled || 0} enabled.` };
    if (id === "connector.salesforce") return { ok: true, id, status: target.status, message: target.configured ? "Salesforce connector is configured." : "Salesforce connector is optional and not configured." };
    if (id === "capabilities.bus") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.contracts || 0} capability contract(s).` };
    if (id === "preferences.local-json") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.active || 0} active preference(s).` };
    if (id === "repo.intelligence") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.summary?.files || 0} mapped file(s), ${target.details.summary?.codeFiles || 0} code file(s).` };
    if (id === "engine.verification") return { ok: target.health === "ok", id, status: target.status, message: "Verification engine is available." };
    if (id === "runtime.profiles") return { ok: true, id, status: target.status, message: `${target.capabilities.length} runtime profile(s) available.` };
    if (id === "runtime.environment") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.os?.platform || "unknown"} environment inspected.` };
    if (id === "control.plane") return { ok: target.health === "ok", id, status: target.status, message: "AI control plane is available." };
    if (id === "backend.supervisor") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.summary?.requiredReady || 0}/${target.details.summary?.required || 0} required service(s) ready.` };
    if (id === "events.local-jsonl") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.total || 0} event(s) recorded.` };
    if (id === "policy.local-json") return { ok: target.health === "ok", id, status: target.status, message: `Policy ${target.details.configured ? "configured" : "using defaults"}.` };
    if (id === "policy.decision-point") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.decision || "unknown"} sample decision.` };
    if (id === "risk.scorer") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.level || "unknown"} sample risk.` };
    if (id === "context.budget") return { ok: target.health === "ok", id, status: target.status, message: "Context budget manager is available." };
    if (id === "model.mesh") return { ok: target.health === "ok", id, status: target.status, message: `${target.capabilities.length} model role(s) available.` };
    if (id === "learning.feedback") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.total || 0} feedback event(s).` };
    if (id === "workflow.state") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.total || 0} workflow state(s).` };
    if (id === "run.ledger") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.total || 0} run ledger record(s).` };
    if (id === "artifacts.local-store") return { ok: target.health === "ok", id, status: target.status, message: `${target.details.total || 0} artifact(s).` };
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

async function testDuckDuckGoSearch() {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", "Jarvis AI");
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  const data = await fetchJson(url.toString(), { timeoutMs: 8000 });
  return {
    ok: true,
    id: "search.duckduckgo",
    status: "online",
    message: `${data.Heading || "DuckDuckGo"} fallback search responded.`
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
