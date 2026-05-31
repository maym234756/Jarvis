#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, getProviderStatus } from "../../packages/config/env.js";
import { createAgent } from "../../packages/agent-core/index.js";
import { createDefaultToolRegistry } from "../../packages/tool-runtime/index.js";
import { MemoryStore } from "../../packages/memory/index.js";
import { WorkflowEngine } from "../../packages/workflow-engine/index.js";
import { ModelRouter } from "../../packages/model-router/index.js";
import { SessionStore } from "../../packages/session/index.js";
import { RunStore } from "../../packages/runs/index.js";
import { runDoctor } from "../../packages/diagnostics/index.js";
import { BackendDockingStation } from "../../packages/docking/index.js";
import { DockingStatusTool, DockingTestTool } from "../../packages/tool-runtime/tools/docking-tool.js";
import { ReasoningEngine } from "../../packages/reasoning/index.js";
import { SearchEngine } from "../../packages/search/index.js";
import { getEngineStatus } from "../../packages/engine/index.js";
import { MetricsStore } from "../../packages/metrics/index.js";
import { ConnectorRegistry } from "../../packages/connectors/index.js";
import { BackendEvalRunner } from "../../packages/evals/index.js";
import { EvalsRunTool } from "../../packages/tool-runtime/tools/evals-tool.js";
import { PreferenceStore } from "../../packages/preferences/index.js";
import { RepoIntelligence } from "../../packages/repo-intelligence/index.js";
import { VerificationEngine } from "../../packages/verification/index.js";
import { listRuntimeProfiles } from "../../packages/runtime/index.js";
import { CapabilityBus } from "../../packages/capabilities/index.js";
import { ContextBudgetManager } from "../../packages/context-budget/index.js";
import { EnvironmentInspector } from "../../packages/environment/index.js";
import { FeedbackStore } from "../../packages/learning/index.js";
import { ModelMesh } from "../../packages/model-mesh/index.js";
import { EventBus } from "../../packages/events/index.js";
import { PolicyStore } from "../../packages/policy/index.js";
import { WorkflowStateStore } from "../../packages/workflow-state/index.js";
import { ArtifactStore } from "../../packages/artifacts/index.js";
import { AIControlPlane } from "../../packages/control-plane/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });
const port = Number(process.env.JARVIS_PORT || 8787);
const webRoot = path.join(projectRoot, "apps", "web-console");
const memoryStore = new MemoryStore({ projectRoot });
const sessionStore = new SessionStore({ projectRoot });
const runStore = new RunStore({ projectRoot });
const metricsStore = new MetricsStore({ projectRoot });
const connectorRegistry = new ConnectorRegistry({ projectRoot });
const preferenceStore = new PreferenceStore({ projectRoot });
const repoIntelligence = new RepoIntelligence({ projectRoot });
const verificationEngine = new VerificationEngine();
const contextBudgetManager = new ContextBudgetManager();
const environmentInspector = new EnvironmentInspector({ projectRoot });
const feedbackStore = new FeedbackStore({ projectRoot });
const modelMesh = new ModelMesh({ feedbackStore });
const capabilityBus = new CapabilityBus();
const eventBus = new EventBus({ projectRoot });
const policyStore = new PolicyStore({ projectRoot });
const workflowStateStore = new WorkflowStateStore({ projectRoot });
const artifactStore = new ArtifactStore({ projectRoot });
const modelRouter = new ModelRouter();
const workflowEngine = new WorkflowEngine();
const controlPlane = new AIControlPlane({ workflowEngine, modelMesh, contextBudgetManager, capabilityBus, policyStore });
const reasoningEngine = new ReasoningEngine();
const searchEngine = new SearchEngine();
const toolRegistry = createDefaultToolRegistry({ projectRoot, memoryStore, searchEngine, metricsStore, connectorRegistry, preferenceStore, repoIntelligence, capabilityBus, environmentInspector, contextBudgetManager, feedbackStore, modelMesh, controlPlane, eventBus, policyStore, workflowStateStore, artifactStore });
capabilityBus.setToolRegistry(toolRegistry);
controlPlane.setToolRegistry(toolRegistry).setCapabilityBus(capabilityBus);
const evalRunner = new BackendEvalRunner({ projectRoot, toolRegistry, memoryStore, searchEngine, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane });
const dockingStation = new BackendDockingStation({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane });
toolRegistry.register(new DockingStatusTool(dockingStation));
toolRegistry.register(new DockingTestTool(dockingStation));
toolRegistry.register(new EvalsRunTool(evalRunner));
const agent = createAgent({
  projectRoot,
  modelRouter,
  toolRegistry,
  memoryStore,
  workflowEngine,
  sessionStore,
  runStore,
  reasoningEngine,
  verificationEngine,
  preferenceStore,
  contextBudgetManager,
  feedbackStore,
  modelMesh,
  eventBus,
  workflowStateStore,
  artifactStore
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function sendStatic(res, fileName, contentType) {
  const filePath = path.join(webRoot, fileName);
  const body = await fs.promises.readFile(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      await sendStatic(res, "index.html", "text/html; charset=utf-8");
      return;
    }

    if (req.method === "GET" && url.pathname === "/styles.css") {
      await sendStatic(res, "styles.css", "text/css; charset=utf-8");
      return;
    }

    if (req.method === "GET" && url.pathname === "/app.js") {
      await sendStatic(res, "app.js", "text/javascript; charset=utf-8");
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      send(res, 200, { ok: true, service: "jarvis-api", projectRoot, providers: getProviderStatus() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/providers") {
      send(res, 200, getProviderStatus());
      return;
    }

    if (req.method === "GET" && url.pathname === "/tools") {
      send(res, 200, { tools: toolRegistry.listTools() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/connectors") {
      send(res, 200, { ok: true, status: await connectorRegistry.status(), connectors: await connectorRegistry.listConnectors() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/runtime-profiles") {
      send(res, 200, { ok: true, profiles: listRuntimeProfiles() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/capabilities") {
      send(res, 200, { ok: true, capabilities: capabilityBus.listCapabilities() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/capabilities/search") {
      const body = await readJson(req);
      send(res, 200, { ok: true, capabilities: capabilityBus.search(body.query || "", { limit: body.limit || 8 }) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/capabilities/simulate") {
      const body = await readJson(req);
      send(res, 200, await capabilityBus.simulate(body.tool, body.args || {}, { projectRoot }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/environment") {
      send(res, 200, { ok: true, environment: await environmentInspector.inspect() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/context-budget") {
      const body = await readJson(req);
      send(res, 200, { ok: true, budget: contextBudgetManager.allocate(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/feedback") {
      send(res, 200, { ok: true, summary: await feedbackStore.summary(), events: await feedbackStore.list({ limit: Number(url.searchParams.get("limit") || 50), taskType: url.searchParams.get("taskType") || undefined }) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/feedback") {
      const body = await readJson(req);
      send(res, 200, { ok: true, event: await feedbackStore.record({ ...body, source: body.source || "user" }) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/model-mesh/route") {
      const body = await readJson(req);
      send(res, 200, { ok: true, route: await modelMesh.route(body) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/control-plane/decide") {
      const body = await readJson(req);
      send(res, 200, { ok: true, decision: await controlPlane.decide(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/events") {
      send(res, 200, { ok: true, summary: await eventBus.summary(), events: await eventBus.list({ limit: Number(url.searchParams.get("limit") || 100), type: url.searchParams.get("type") || undefined }) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/policy") {
      send(res, 200, { ok: true, status: await policyStore.status(), policy: await policyStore.getPolicy() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/policy") {
      const body = await readJson(req);
      send(res, 200, { ok: true, policy: await policyStore.savePolicy(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/workflow-state") {
      send(res, 200, { ok: true, summary: await workflowStateStore.summary(), states: await workflowStateStore.list({ limit: Number(url.searchParams.get("limit") || 50) }) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/artifacts") {
      send(res, 200, { ok: true, summary: await artifactStore.summary(), artifacts: await artifactStore.list({ limit: Number(url.searchParams.get("limit") || 50), type: url.searchParams.get("type") || undefined }) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/artifacts") {
      const body = await readJson(req);
      send(res, 200, { ok: true, artifact: await artifactStore.create(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/preferences") {
      send(res, 200, { ok: true, stats: await preferenceStore.stats(), preferences: await preferenceStore.list() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/preferences") {
      const body = await readJson(req);
      send(res, 200, { ok: true, preference: await preferenceStore.set(body) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/preferences/gc") {
      const body = await readJson(req);
      send(res, 200, { ok: true, result: await preferenceStore.garbageCollect(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/repo") {
      send(res, 200, { ok: true, map: await repoIntelligence.buildMap({ maxFiles: Number(url.searchParams.get("maxFiles") || 500) }) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/connectors") {
      const body = await readJson(req);
      send(res, 200, { ok: true, connector: await connectorRegistry.addConnector(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/doctor") {
      send(res, 200, await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner, preferenceStore, repoIntelligence, feedbackStore, environmentInspector, eventBus, policyStore, workflowStateStore, artifactStore }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/docking") {
      send(res, 200, await dockingStation.report());
      return;
    }

    if (req.method === "GET" && url.pathname === "/engine") {
      send(res, 200, await getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/evals") {
      send(res, 200, await evalRunner.run({ filter: url.searchParams.get("filter") || undefined }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/metrics") {
      send(res, 200, {
        ok: true,
        summary: await metricsStore.summary(),
        events: await metricsStore.list({ limit: Number(url.searchParams.get("limit") || 50), type: url.searchParams.get("type") || undefined })
      });
      return;
    }

    const dockTestMatch = url.pathname.match(/^\/docking\/([^/]+)\/test$/);
    if (req.method === "POST" && dockTestMatch) {
      send(res, 200, await dockingStation.testDock(decodeURIComponent(dockTestMatch[1])));
      return;
    }

    const connectorTestMatch = url.pathname.match(/^\/connectors\/([^/]+)\/test$/);
    if (req.method === "POST" && connectorTestMatch) {
      send(res, 200, await connectorRegistry.testConnector(decodeURIComponent(connectorTestMatch[1])));
      return;
    }

    if (req.method === "POST" && url.pathname === "/chat") {
      const body = await readJson(req);
      if (!body.message) {
        send(res, 400, { ok: false, error: "message is required" });
        return;
      }
      const session = body.sessionId
        ? await sessionStore.getSession(body.sessionId)
        : await sessionStore.createSession({
          title: body.title || "Jarvis web session",
          mode: body.mode || "agent",
          privacyLevel: body.privacyLevel || "project"
        });
      const result = await agent.handleMessage(body.message, {
        mode: body.mode || "agent",
        privacyLevel: body.privacyLevel || "project",
        runtimeProfile: body.runtimeProfile || body.depth || "balanced",
        projectRoot,
        sessionId: session.id,
        sessionHistory: session.messages || [],
        sessionSummary: session.compaction?.summary || ""
      });
      send(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/ingest") {
      const body = await readJson(req);
      const result = await toolRegistry.execute("memory.ingest", { path: body.path || "." }, { projectRoot });
      send(res, result.ok ? 200 : 400, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/memory/query") {
      const body = await readJson(req);
      const matches = await memoryStore.query(body.query || "", {
        limit: body.limit || 5,
        filters: body.filters || {}
      });
      send(res, 200, { ok: true, matches });
      return;
    }

    if (req.method === "GET" && url.pathname === "/memory/stats") {
      send(res, 200, { ok: true, stats: await memoryStore.stats() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/memory/compact") {
      send(res, 200, { ok: true, result: await memoryStore.compact() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/memory/rebuild") {
      const body = await readJson(req);
      send(res, 200, { ok: true, result: await memoryStore.rebuildIndex(body.path || ".") });
      return;
    }

    if (req.method === "GET" && url.pathname === "/approvals") {
      const status = url.searchParams.get("status") || undefined;
      const approvals = toolRegistry.approvalQueue ? await toolRegistry.approvalQueue.list({ status }) : [];
      send(res, 200, { ok: true, approvals });
      return;
    }

    if (req.method === "GET" && url.pathname === "/sessions") {
      send(res, 200, { ok: true, sessions: await sessionStore.listSessions({ limit: Number(url.searchParams.get("limit") || 20) }) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/sessions") {
      const body = await readJson(req);
      send(res, 200, { ok: true, session: await sessionStore.createSession(body) });
      return;
    }

    const sessionMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (req.method === "GET" && sessionMatch) {
      send(res, 200, { ok: true, session: await sessionStore.getSession(sessionMatch[1]) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/runs") {
      send(res, 200, {
        ok: true,
        stats: await runStore.stats(),
        runs: await runStore.listRuns({
          limit: Number(url.searchParams.get("limit") || 20),
          sessionId: url.searchParams.get("sessionId") || undefined
        })
      });
      return;
    }

    const approvalMatch = url.pathname.match(/^\/approvals\/([^/]+)$/);
    if (req.method === "POST" && approvalMatch) {
      const body = await readJson(req);
      const result = await toolRegistry.approve(approvalMatch[1], {
        approved: Boolean(body.approved),
        note: body.note
      });
      send(res, result.ok ? 200 : 400, result);
      return;
    }

    send(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    send(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Jarvis API listening on http://localhost:${port}`);
});
