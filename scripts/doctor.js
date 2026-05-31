#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { MemoryStore } from "../packages/memory/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { RunStore } from "../packages/runs/index.js";
import { SessionStore } from "../packages/session/index.js";
import { BackendDockingStation } from "../packages/docking/index.js";
import { DockingStatusTool, DockingTestTool } from "../packages/tool-runtime/tools/docking-tool.js";
import { formatDoctorReport, runDoctor } from "../packages/diagnostics/index.js";
import { ModelRouter } from "../packages/model-router/index.js";
import { WorkflowEngine } from "../packages/workflow-engine/index.js";
import { ReasoningEngine } from "../packages/reasoning/index.js";
import { SearchEngine } from "../packages/search/index.js";
import { MetricsStore } from "../packages/metrics/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });

const memoryStore = new MemoryStore({ projectRoot });
const sessionStore = new SessionStore({ projectRoot });
const runStore = new RunStore({ projectRoot });
const metricsStore = new MetricsStore({ projectRoot });
const modelRouter = new ModelRouter();
const workflowEngine = new WorkflowEngine();
const reasoningEngine = new ReasoningEngine();
const searchEngine = new SearchEngine();
const toolRegistry = createDefaultToolRegistry({ projectRoot, memoryStore, searchEngine, metricsStore });
const dockingStation = new BackendDockingStation({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore });
toolRegistry.register(new DockingStatusTool(dockingStation));
toolRegistry.register(new DockingTestTool(dockingStation));
const report = await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation });

console.log(formatDoctorReport(report));
process.exitCode = report.ok ? 0 : 1;
