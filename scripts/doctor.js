#!/usr/bin/env node
import { loadEnv } from "../packages/config/env.js";
import { createBackendKernel } from "../packages/backend/index.js";
import { formatDoctorReport, runDoctor } from "../packages/diagnostics/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });

const {
  memoryStore,
  toolRegistry,
  runStore,
  sessionStore,
  dockingStation,
  evalRunner,
  preferenceStore,
  repoIntelligence,
  feedbackStore,
  environmentInspector,
  eventBus,
  policyStore,
  workflowStateStore,
  artifactStore,
  riskScorer,
  policyDecisionPoint,
  runLedger,
  backendSupervisor
} = createBackendKernel({ projectRoot, port: Number(process.env.JARVIS_PORT || 8787) });
const report = await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner, preferenceStore, repoIntelligence, feedbackStore, environmentInspector, eventBus, policyStore, workflowStateStore, artifactStore, riskScorer, policyDecisionPoint, runLedger, backendSupervisor });

console.log(formatDoctorReport(report));
process.exitCode = report.ok ? 0 : 1;
