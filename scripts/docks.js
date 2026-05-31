#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { MemoryStore } from "../packages/memory/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { RunStore } from "../packages/runs/index.js";
import { SessionStore } from "../packages/session/index.js";
import { BackendDockingStation, formatDockReport } from "../packages/docking/index.js";
import { DockingStatusTool, DockingTestTool } from "../packages/tool-runtime/tools/docking-tool.js";
import { ModelRouter } from "../packages/model-router/index.js";
import { WorkflowEngine } from "../packages/workflow-engine/index.js";
import { ReasoningEngine } from "../packages/reasoning/index.js";
import { SearchEngine } from "../packages/search/index.js";
import { MetricsStore } from "../packages/metrics/index.js";
import { ConnectorRegistry } from "../packages/connectors/index.js";
import { BackendEvalRunner } from "../packages/evals/index.js";
import { EvalsRunTool } from "../packages/tool-runtime/tools/evals-tool.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });

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

const [command, id] = process.argv.slice(2);
if (command === "test") {
  if (!id) {
    console.error("Usage: npm run docks -- test <dock-id>");
    process.exit(1);
  }
  console.log(await dockingStation.testDock(id));
} else {
  console.log(formatDockReport(await dockingStation.report()));
}
