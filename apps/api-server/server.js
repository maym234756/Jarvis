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

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });
const port = Number(process.env.JARVIS_PORT || 8787);
const webRoot = path.join(projectRoot, "apps", "web-console");
const memoryStore = new MemoryStore({ projectRoot });
const sessionStore = new SessionStore({ projectRoot });
const runStore = new RunStore({ projectRoot });
const metricsStore = new MetricsStore({ projectRoot });
const connectorRegistry = new ConnectorRegistry({ projectRoot });
const modelRouter = new ModelRouter();
const workflowEngine = new WorkflowEngine();
const reasoningEngine = new ReasoningEngine();
const searchEngine = new SearchEngine();
const toolRegistry = createDefaultToolRegistry({ projectRoot, memoryStore, searchEngine, metricsStore, connectorRegistry });
const evalRunner = new BackendEvalRunner({ projectRoot, toolRegistry, memoryStore, searchEngine });
const dockingStation = new BackendDockingStation({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner });
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
  reasoningEngine
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

    if (req.method === "POST" && url.pathname === "/connectors") {
      const body = await readJson(req);
      send(res, 200, { ok: true, connector: await connectorRegistry.addConnector(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/doctor") {
      send(res, 200, await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner }));
      return;
    }

    if (req.method === "GET" && url.pathname === "/docking") {
      send(res, 200, await dockingStation.report());
      return;
    }

    if (req.method === "GET" && url.pathname === "/engine") {
      send(res, 200, await getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry }));
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
