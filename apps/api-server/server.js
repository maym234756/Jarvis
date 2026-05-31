#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, getProviderStatus } from "../../packages/config/env.js";
import { createBackendKernel } from "../../packages/backend/index.js";
import { runDoctor } from "../../packages/diagnostics/index.js";
import { getEngineStatus } from "../../packages/engine/index.js";
import { listRuntimeProfiles } from "../../packages/runtime/index.js";
import { classifyFailure } from "../../packages/risk/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });
const port = Number(process.env.JARVIS_PORT || 8787);
const webRoot = path.join(projectRoot, "apps", "web-console");
const backend = createBackendKernel({ projectRoot, port });
const {
  memoryStore,
  sessionStore,
  runStore,
  metricsStore,
  connectorRegistry,
  preferenceStore,
  repoIntelligence,
  verificationEngine,
  contextBudgetManager,
  environmentInspector,
  feedbackStore,
  modelMesh,
  capabilityBus,
  eventBus,
  policyStore,
  riskScorer,
  policyDecisionPoint,
  workflowStateStore,
  artifactStore,
  runLedger,
  modelRouter,
  workflowEngine,
  controlPlane,
  reasoningEngine,
  searchEngine,
  toolRegistry,
  evalRunner,
  dockingStation,
  agent,
  backendSupervisor
} = backend;

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

function sendSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
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
      const readiness = await backendSupervisor.readiness();
      send(res, 200, { ok: true, service: "jarvis-api", instanceId: process.env.JARVIS_INSTANCE_ID || null, projectRoot, readiness: readiness.status, providers: getProviderStatus() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/ready") {
      const readiness = await backendSupervisor.readiness();
      send(res, readiness.ok ? 200 : 503, readiness);
      return;
    }

    if (req.method === "GET" && url.pathname === "/backend") {
      send(res, 200, await backendSupervisor.report());
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
      send(res, 200, { ok: true, status: await connectorRegistry.status(), connectors: await connectorRegistry.listConnectors(), accountConnectors: connectorRegistry.discoverAccountConnectors() });
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

    if (req.method === "GET" && url.pathname === "/events/stream") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      });
      sendSse(res, "ready", { ok: true, timestamp: new Date().toISOString() });
      const unsubscribe = eventBus.subscribe((event) => {
        const type = url.searchParams.get("type");
        if (!type || event.type === type) sendSse(res, "jarvis-event", event);
      });
      const heartbeat = setInterval(() => sendSse(res, "heartbeat", { timestamp: new Date().toISOString() }), 15000);
      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      });
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

    if (req.method === "POST" && url.pathname === "/policy/decide") {
      const body = await readJson(req);
      send(res, 200, { ok: true, decision: await policyDecisionPoint.decide(body) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/risk/score") {
      const body = await readJson(req);
      send(res, 200, { ok: true, risk: riskScorer.scoreAction(body) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/failures/classify") {
      const body = await readJson(req);
      send(res, 200, { ok: true, failure: classifyFailure(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/run-ledger") {
      send(res, 200, {
        ok: true,
        summary: await runLedger.summary(),
        records: await runLedger.list({ limit: Number(url.searchParams.get("limit") || 50), status: url.searchParams.get("status") || undefined })
      });
      return;
    }

    const runReplayMatch = url.pathname.match(/^\/run-ledger\/([^/]+)\/replay$/);
    if (req.method === "GET" && runReplayMatch) {
      send(res, 200, { ok: true, replay: await runLedger.replay(decodeURIComponent(runReplayMatch[1])) });
      return;
    }

    const runLedgerMatch = url.pathname.match(/^\/run-ledger\/([^/]+)$/);
    if (req.method === "GET" && runLedgerMatch) {
      const record = await runLedger.get(decodeURIComponent(runLedgerMatch[1]));
      send(res, record ? 200 : 404, record ? { ok: true, record } : { ok: false, error: "run ledger record not found" });
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
      send(res, 200, await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner, preferenceStore, repoIntelligence, feedbackStore, environmentInspector, eventBus, policyStore, workflowStateStore, artifactStore, riskScorer, policyDecisionPoint, runLedger, backendSupervisor }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/docking") {
      send(res, 200, await dockingStation.report());
      return;
    }

    if (req.method === "GET" && url.pathname === "/engine") {
      send(res, 200, await getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger, backendSupervisor }));
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
