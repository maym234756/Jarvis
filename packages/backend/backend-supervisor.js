import path from "node:path";
import { getProviderStatus } from "../config/env.js";

export class BackendSupervisor {
  constructor({ projectRoot = process.cwd(), services = {}, port = Number(process.env.JARVIS_PORT || 8787) } = {}) {
    this.projectRoot = projectRoot;
    this.services = services;
    this.port = port;
  }

  async report() {
    const definitions = this.#definitions();
    const services = [];
    for (const definition of definitions) {
      services.push(await this.#inspect(definition));
    }
    const summary = summarizeServices(services);
    const blocking = services.filter((service) => service.required && service.health === "error");
    const warnings = services.filter((service) => service.health === "warn");
    return {
      ok: blocking.length === 0,
      generated_at: new Date().toISOString(),
      projectRoot: this.projectRoot,
      readiness: {
        status: blocking.length ? "not_ready" : warnings.length ? "degraded" : "ready",
        blocking: blocking.map((service) => ({ id: service.id, status: service.status, message: service.message })),
        warnings: warnings.map((service) => ({ id: service.id, status: service.status, message: service.message }))
      },
      summary,
      topology: {
        nodes: services.map((service) => ({
          id: service.id,
          type: service.type,
          required: service.required,
          health: service.health
        })),
        edges: services.flatMap((service) => service.dependencies.map((dependency) => ({
          from: service.id,
          to: dependency
        })))
      },
      services
    };
  }

  async readiness() {
    const report = await this.report();
    return {
      ok: report.ok,
      generated_at: report.generated_at,
      status: report.readiness.status,
      summary: report.summary,
      blocking: report.readiness.blocking,
      warnings: report.readiness.warnings
    };
  }

  async #inspect(definition) {
    const ref = definition.ref?.();
    if (!ref) {
      return serviceResult(definition, {
        status: "missing",
        health: definition.required ? "error" : "warn",
        message: definition.recommendation || "Service is not wired into this backend runtime."
      });
    }

    try {
      const probe = definition.probe ? await definition.probe(ref) : {};
      return serviceResult(definition, {
        status: probe.status || "ready",
        health: probe.health || "ok",
        message: probe.message || "Ready.",
        details: probe.details || {}
      });
    } catch (error) {
      return serviceResult(definition, {
        status: "error",
        health: "error",
        message: error.message,
        details: {}
      });
    }
  }

  #definitions() {
    const get = (key) => () => this.services[key];
    return [
      define({
        id: "runtime.node",
        name: "Node.js Runtime",
        type: "runtime",
        ref: () => process,
        capabilities: ["javascript-runtime", "node-test"],
        probe: () => ({
          details: { version: process.version, platform: process.platform, arch: process.arch }
        })
      }),
      define({
        id: "core.api-surface",
        name: "API Surface",
        type: "core",
        ref: () => true,
        dependencies: ["agent.orchestrator", "tools.registry", "memory.local-jsonl"],
        capabilities: ["http-api", "web-console", "readiness"],
        probe: () => ({
          details: {
            port: this.port,
            endpoint: `http://localhost:${this.port}`,
            webRoot: path.join(this.projectRoot, "apps", "web-console")
          }
        })
      }),
      define({
        id: "agent.orchestrator",
        name: "Agent Orchestrator",
        type: "agent",
        ref: get("agent"),
        dependencies: ["model.router", "tools.registry", "memory.local-jsonl", "workflow.engine", "run.store", "session.store"],
        capabilities: ["planning", "tool-execution", "grounded-answering"]
      }),
      define({
        id: "model.router",
        name: "Model Router",
        type: "model",
        ref: get("modelRouter"),
        dependencies: ["runtime.node"],
        capabilities: ["local-first-routing", "provider-fallback"],
        probe: (modelRouter) => ({
          details: modelRouter.describe ? modelRouter.describe({ privacyLevel: "project" }) : {}
        })
      }),
      define({
        id: "model.mesh",
        name: "Model Mesh",
        type: "model",
        ref: get("modelMesh"),
        dependencies: ["learning.feedback"],
        capabilities: ["role-routing", "critic-support"],
        probe: (modelMesh) => ({
          details: { roles: modelMesh.listRoles ? modelMesh.listRoles().map((role) => role.id) : [] }
        })
      }),
      define({
        id: "workflow.engine",
        name: "Workflow Engine",
        type: "workflow",
        ref: get("workflowEngine"),
        capabilities: ["task-workflows", "workflow-selection"],
        probe: (workflowEngine) => {
          const workflows = workflowEngine.list ? workflowEngine.list().map((workflow) => workflow.name) : [];
          return {
            health: workflows.length ? "ok" : "warn",
            status: workflows.length ? "ready" : "degraded",
            message: workflows.length ? "Workflow templates loaded." : "No workflow templates are loaded.",
            details: { workflows }
          };
        }
      }),
      define({
        id: "tools.registry",
        name: "Tool Registry",
        type: "tools",
        ref: get("toolRegistry"),
        dependencies: ["policy.engine", "approval.queue", "metrics.store"],
        capabilities: ["tool-contracts", "approval-gates", "audit"],
        probe: (toolRegistry) => {
          const tools = toolRegistry.listTools ? toolRegistry.listTools() : [];
          return {
            health: tools.length ? "ok" : "error",
            status: tools.length ? "ready" : "empty",
            message: `${tools.length} tool(s) registered.`,
            details: {
              count: tools.length,
              tools: tools.map((tool) => tool.name).sort()
            }
          };
        }
      }),
      define({
        id: "policy.engine",
        name: "Tool Policy Engine",
        type: "safety",
        ref: () => this.services.toolRegistry?.policyEngine,
        capabilities: ["risk-tiers", "approval-policy", "dangerous-action-blocking"]
      }),
      define({
        id: "approval.queue",
        name: "Approval Queue",
        type: "safety",
        ref: () => this.services.toolRegistry?.approvalQueue || this.services.approvalProvider,
        capabilities: ["human-approval", "pending-actions"],
        probe: async (approvalQueue) => {
          if (typeof approvalQueue === "function") return { details: { mode: "inline" } };
          const pending = approvalQueue.list ? await approvalQueue.list({ status: "pending" }) : [];
          return { details: { mode: "queued", pending: pending.length } };
        }
      }),
      define({
        id: "memory.local-jsonl",
        name: "Local Memory Store",
        type: "memory",
        ref: get("memoryStore"),
        capabilities: ["chunking", "retrieval", "local-embeddings"],
        probe: async (memoryStore) => ({
          details: await memoryStore.stats()
        })
      }),
      define({
        id: "session.store",
        name: "Session Store",
        type: "state",
        ref: get("sessionStore"),
        capabilities: ["saved-chat", "context-compaction"],
        probe: async (sessionStore) => {
          const sessions = await sessionStore.listSessions({ limit: 1000 });
          return { details: { count: sessions.length } };
        }
      }),
      define({
        id: "run.store",
        name: "Run Store",
        type: "state",
        ref: get("runStore"),
        capabilities: ["run-history", "duration-tracking"],
        probe: async (runStore) => ({
          details: await runStore.stats()
        })
      }),
      define({
        id: "run.ledger",
        name: "Replayable Run Ledger",
        type: "observability",
        ref: get("runLedger"),
        dependencies: ["run.store"],
        capabilities: ["trace-replay", "failure-analysis"],
        probe: async (runLedger) => ({
          details: await runLedger.summary()
        })
      }),
      define({
        id: "events.bus",
        name: "Event Bus",
        type: "observability",
        ref: get("eventBus"),
        capabilities: ["event-log", "sse-stream"],
        probe: async (eventBus) => ({
          details: await eventBus.summary()
        })
      }),
      define({
        id: "metrics.store",
        name: "Metrics Store",
        type: "observability",
        ref: get("metricsStore"),
        capabilities: ["tool-duration", "cache-visibility"],
        probe: async (metricsStore) => ({
          details: await metricsStore.summary()
        })
      }),
      define({
        id: "engine.reasoning",
        name: "Reasoning Engine",
        type: "engine",
        ref: get("reasoningEngine"),
        capabilities: ["task-traits", "evidence-needs", "answer-contracts"]
      }),
      define({
        id: "engine.verification",
        name: "Verification Engine",
        type: "engine",
        ref: get("verificationEngine"),
        capabilities: ["tool-result-checks", "citation-checks", "confidence"]
      }),
      define({
        id: "engine.search",
        name: "Search Engine",
        type: "engine",
        ref: get("searchEngine"),
        capabilities: ["query-planning", "source-ranking", "prompt-injection-scan"],
        probe: (searchEngine) => ({
          details: searchEngine.cacheStatus ? searchEngine.cacheStatus() : {}
        })
      }),
      define({
        id: "control.plane",
        name: "AI Control Plane",
        type: "control",
        ref: get("controlPlane"),
        dependencies: ["workflow.engine", "model.mesh", "capabilities.bus", "policy.store", "risk.scorer"],
        capabilities: ["intent-routing", "policy-preflight", "tool-scope"]
      }),
      define({
        id: "capabilities.bus",
        name: "Capability Bus",
        type: "tools",
        ref: get("capabilityBus"),
        dependencies: ["tools.registry"],
        capabilities: ["capability-search", "simulation", "contracts"],
        probe: (capabilityBus) => {
          const capabilities = capabilityBus.listCapabilities ? capabilityBus.listCapabilities() : [];
          return {
            health: capabilities.length ? "ok" : "warn",
            status: capabilities.length ? "ready" : "degraded",
            message: `${capabilities.length} capability contract(s).`,
            details: { count: capabilities.length }
          };
        }
      }),
      define({
        id: "context.budget",
        name: "Context Budget Manager",
        type: "context",
        ref: get("contextBudgetManager"),
        capabilities: ["token-budgeting", "pressure-detection"]
      }),
      define({
        id: "runtime.environment",
        name: "Environment Inspector",
        type: "runtime",
        ref: get("environmentInspector"),
        capabilities: ["os-detection", "git-status", "package-manager"],
        probe: async (environmentInspector) => {
          const environment = await environmentInspector.inspect();
          return {
            details: {
              os: environment.os,
              packageManager: environment.packageManager,
              git: environment.git,
              resources: environment.resources
            }
          };
        }
      }),
      define({
        id: "policy.store",
        name: "Policy Store",
        type: "safety",
        ref: get("policyStore"),
        capabilities: ["policy-as-code", "network-defaults", "secret-rules"],
        probe: async (policyStore) => ({
          details: await policyStore.status()
        })
      }),
      define({
        id: "policy.decision-point",
        name: "Policy Decision Point",
        type: "safety",
        ref: get("policyDecisionPoint"),
        dependencies: ["policy.store", "risk.scorer"],
        capabilities: ["allow-deny-approval", "sandbox-routing"]
      }),
      define({
        id: "risk.scorer",
        name: "Risk Scorer",
        type: "safety",
        ref: get("riskScorer"),
        capabilities: ["step-risk", "plan-risk", "failure-taxonomy"],
        probe: (riskScorer) => ({
          details: riskScorer.scoreAction({ action: "status check", dataSensitivity: "internal" })
        })
      }),
      define({
        id: "workflow.state",
        name: "Workflow State Store",
        type: "state",
        ref: get("workflowStateStore"),
        capabilities: ["state-transitions", "pause-resume-foundation"],
        probe: async (workflowStateStore) => ({
          details: await workflowStateStore.summary()
        })
      }),
      define({
        id: "artifacts.store",
        name: "Artifact Store",
        type: "state",
        ref: get("artifactStore"),
        capabilities: ["generated-artifacts", "metadata"],
        probe: async (artifactStore) => ({
          details: await artifactStore.summary()
        })
      }),
      define({
        id: "learning.feedback",
        name: "Feedback Store",
        type: "learning",
        ref: get("feedbackStore"),
        capabilities: ["outcome-tracking", "route-feedback"],
        probe: async (feedbackStore) => ({
          details: await feedbackStore.summary()
        })
      }),
      define({
        id: "connectors.registry",
        name: "Connector Registry",
        type: "connectors",
        ref: get("connectorRegistry"),
        capabilities: ["mcp-style-connectors", "account-connectors"],
        probe: async (connectorRegistry) => ({
          details: await connectorRegistry.status()
        })
      }),
      define({
        id: "repo.intelligence",
        name: "Repository Intelligence",
        type: "code",
        ref: get("repoIntelligence"),
        capabilities: ["file-map", "symbol-index", "test-hints"],
        probe: async (repoIntelligence) => {
          const map = await repoIntelligence.buildMap({ maxFiles: 250 });
          return {
            details: {
              summary: map.summary,
              tests: map.tests,
              languages: map.languages
            }
          };
        }
      }),
      define({
        id: "evals.backend",
        name: "Backend Eval Runner",
        type: "quality",
        ref: get("evalRunner"),
        capabilities: ["regression-evals", "safety-evals"],
        probe: () => ({ message: "Eval runner available; run evals on demand." })
      }),
      define({
        id: "providers.status",
        name: "Provider Configuration",
        type: "providers",
        required: false,
        ref: () => getProviderStatus(),
        capabilities: ["local-model-status", "search-status", "embedding-status"],
        probe: (providers) => ({
          health: providers.ollama.configured || providers.openai.enabled ? "ok" : "warn",
          status: providers.ollama.configured || providers.openai.enabled ? "ready" : "degraded",
          message: providers.ollama.configured || providers.openai.enabled
            ? "A model provider is configured."
            : "Using local draft responses until Ollama or an enabled hosted connector is configured.",
          details: providers
        })
      })
    ];
  }
}

function define(input) {
  return {
    required: true,
    dependencies: [],
    capabilities: [],
    recommendation: null,
    ...input
  };
}

function serviceResult(definition, result) {
  return {
    id: definition.id,
    name: definition.name,
    type: definition.type,
    required: definition.required,
    status: result.status,
    health: result.health,
    message: result.message,
    dependencies: definition.dependencies,
    capabilities: definition.capabilities,
    recommendation: definition.recommendation,
    details: result.details || {}
  };
}

function summarizeServices(services) {
  const byType = {};
  for (const service of services) {
    byType[service.type] = (byType[service.type] || 0) + 1;
  }
  return {
    total: services.length,
    ready: services.filter((service) => service.health === "ok").length,
    degraded: services.filter((service) => service.health === "warn").length,
    missing: services.filter((service) => service.status === "missing").length,
    errors: services.filter((service) => service.health === "error").length,
    required: services.filter((service) => service.required).length,
    requiredReady: services.filter((service) => service.required && service.health === "ok").length,
    requiredDegraded: services.filter((service) => service.required && service.health === "warn").length,
    requiredErrors: services.filter((service) => service.required && service.health === "error").length,
    byType
  };
}
