#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { MemoryStore } from "../packages/memory/index.js";
import { createDefaultToolRegistry } from "../packages/tool-runtime/index.js";
import { SearchEngine } from "../packages/search/index.js";
import { MetricsStore } from "../packages/metrics/index.js";
import { ConnectorRegistry } from "../packages/connectors/index.js";
import { BackendEvalRunner, formatEvalReport } from "../packages/evals/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });

const memoryStore = new MemoryStore({ projectRoot });
const searchEngine = new SearchEngine();
const metricsStore = new MetricsStore({ projectRoot });
const connectorRegistry = new ConnectorRegistry({ projectRoot });
const toolRegistry = createDefaultToolRegistry({ projectRoot, memoryStore, searchEngine, metricsStore, connectorRegistry });
const evalRunner = new BackendEvalRunner({ projectRoot, toolRegistry, memoryStore, searchEngine });
const report = await evalRunner.run({ filter: process.argv[2] });

console.log(formatEvalReport(report));
process.exitCode = report.ok ? 0 : 1;
