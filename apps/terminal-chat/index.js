#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadEnv, getProviderStatus } from "../../packages/config/env.js";
import { createAgent } from "../../packages/agent-core/index.js";
import { createDefaultToolRegistry } from "../../packages/tool-runtime/index.js";
import { MemoryStore } from "../../packages/memory/index.js";
import { WorkflowEngine } from "../../packages/workflow-engine/index.js";
import { ModelRouter } from "../../packages/model-router/index.js";
import { SessionStore } from "../../packages/session/index.js";
import { RunStore } from "../../packages/runs/index.js";
import { formatDoctorReport, runDoctor } from "../../packages/diagnostics/index.js";
import { BackendDockingStation, formatDockReport } from "../../packages/docking/index.js";
import { DockingStatusTool, DockingTestTool } from "../../packages/tool-runtime/tools/docking-tool.js";
import { ReasoningEngine } from "../../packages/reasoning/index.js";
import { SearchEngine } from "../../packages/search/index.js";
import { getEngineStatus } from "../../packages/engine/index.js";
import { MetricsStore } from "../../packages/metrics/index.js";
import { ConnectorRegistry } from "../../packages/connectors/index.js";
import { BackendEvalRunner, formatEvalReport } from "../../packages/evals/index.js";
import { EvalsRunTool } from "../../packages/tool-runtime/tools/evals-tool.js";
import { PreferenceStore } from "../../packages/preferences/index.js";
import { RepoIntelligence } from "../../packages/repo-intelligence/index.js";
import { VerificationEngine } from "../../packages/verification/index.js";
import { listRuntimeProfiles, resolveRuntimeProfile } from "../../packages/runtime/index.js";
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
import { RiskScorer, classifyFailure } from "../../packages/risk/index.js";
import { PolicyDecisionPoint } from "../../packages/policy/index.js";
import { RunLedger } from "../../packages/run-ledger/index.js";

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });
const rl = readline.createInterface({ input, output });

let mode = "agent";
let privacyLevel = "project";
let runtimeProfileName = "balanced";
let activeSession = null;

function printBanner() {
  console.log("Jarvis AI Platform MVP");
  console.log(`Workspace: ${projectRoot}`);
  console.log(`Providers: ${formatProviderStatus(getProviderStatus())}`);
  console.log(`Runtime: ${runtimeProfileName}`);
  if (process.env.JARVIS_BACKEND_URL) console.log(`Backend: ${process.env.JARVIS_BACKEND_URL}`);
  if (activeSession) console.log(`Session: ${activeSession.title} (${activeSession.id})`);
  console.log("Type /help for commands or /exit to leave.");
}

async function askApproval(request) {
  console.log("");
  console.log("Permission required");
  console.log(`Tool: ${request.toolName}`);
  console.log(`Risk: Tier ${request.riskLevel}`);
  if (request.reason) console.log(`Reason: ${request.reason}`);
  if (request.summary) console.log(`Action: ${request.summary}`);
  const answer = await rl.question("Approve? [y/N] ");
  return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
}

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
const riskScorer = new RiskScorer();
const policyDecisionPoint = new PolicyDecisionPoint({ policyStore, riskScorer });
const workflowStateStore = new WorkflowStateStore({ projectRoot });
const artifactStore = new ArtifactStore({ projectRoot });
const runLedger = new RunLedger({ projectRoot });
const modelRouter = new ModelRouter();
const workflowEngine = new WorkflowEngine();
const controlPlane = new AIControlPlane({ workflowEngine, modelMesh, contextBudgetManager, capabilityBus, policyStore, riskScorer, policyDecisionPoint });
const reasoningEngine = new ReasoningEngine();
const searchEngine = new SearchEngine();
const toolRegistry = createDefaultToolRegistry({
  projectRoot,
  memoryStore,
  approvalProvider: askApproval,
  searchEngine,
  metricsStore,
  connectorRegistry,
  preferenceStore,
  repoIntelligence,
  capabilityBus,
  environmentInspector,
  contextBudgetManager,
  feedbackStore,
  modelMesh,
  controlPlane,
  eventBus,
  policyStore,
  workflowStateStore,
  artifactStore,
  riskScorer,
  policyDecisionPoint,
  runLedger
});
capabilityBus.setToolRegistry(toolRegistry);
controlPlane.setToolRegistry(toolRegistry).setCapabilityBus(capabilityBus);
const evalRunner = new BackendEvalRunner({ projectRoot, toolRegistry, memoryStore, searchEngine, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger });
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
  artifactStore,
  riskScorer,
  policyDecisionPoint,
  runLedger
});
const dockingStation = new BackendDockingStation({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger });
toolRegistry.register(new DockingStatusTool(dockingStation));
toolRegistry.register(new DockingTestTool(dockingStation));
toolRegistry.register(new EvalsRunTool(evalRunner));

function printHelp() {
  console.log(`
Commands
  /help                 Show this help
  /tools                List available tools
  /mode <name>          Set mode: chat, code, research, agent, admin
  /privacy <level>      Set privacy: public, project, private
  /profile <name>       Set runtime profile: instant, balanced, deep
  /ingest <path>        Chunk and index a file or directory
  /memory <query>       Search Jarvis memory
  /memory-stats         Show memory index stats
  /compact-memory       Deduplicate and rewrite memory index
  /rebuild-memory <p>   Rebuild memory index from a path
  /doctor               Run Jarvis diagnostics
  /docks                Show backend docking station
  /dock test <id>       Test one backend dock
  /engine               Show engine backend status
  /metrics              Show performance metrics
  /evals                Run backend evals
  /repo                 Show repository intelligence map
  /preferences          Show user preferences
  /preference set <k>: <v>
  /capabilities         Show capability contracts
  /simulate <command>   Simulate a shell command
  /environment          Inspect runtime environment
  /feedback             Show learning-loop feedback
  /model-mesh <task>    Preview model mesh routing
  /control <request>    Preview control-plane decision
  /events               Show backend event summary
  /policy               Show active policy-as-code
  /policy-decide <text> Preview backend policy decision
  /risk <text>          Score risk for an action
  /failure <text>       Classify a failure and recovery path
  /ledger               Show replayable run ledger
  /replay <run-id>      Replay a run ledger trace
  /workflow-state       Show workflow state records
  /artifacts            Show generated artifacts
  /connectors           List backend connectors
  /connector add <id> <url>
  /connector test <id>
  /session new <title>  Start a saved chat session
  /session list         List recent sessions
  /history              Show current session history
  /runs                 Show recent agent runs
  /exit                 Quit

Natural tool prompts
  read <path>
  list <path>
  write <path>: <content>
  run <command>
  search <query>
  ingest <path>
  research <query>
`);
}

function printToolResult(result) {
  const status = result.ok ? "ok" : result.pendingApproval ? "pending" : "failed";
  console.log(`Tool ${result.tool}: ${status}`);
  if (result.summary) console.log(result.summary);
  if (result.error) console.log(`Error: ${result.error}`);
}

async function handleSlashCommand(line) {
  const [command, ...rest] = line.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim();

  if (command === "help") {
    printHelp();
    return true;
  }

  if (command === "exit" || command === "quit") {
    await rl.close();
    process.exit(0);
  }

  if (command === "tools") {
    for (const tool of toolRegistry.listTools()) {
      console.log(`${tool.name} - tier ${tool.riskLevel} - ${tool.description}`);
    }
    return true;
  }

  if (command === "doctor") {
    const report = await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner, preferenceStore, repoIntelligence, feedbackStore, environmentInspector, eventBus, policyStore, workflowStateStore, artifactStore, riskScorer, policyDecisionPoint, runLedger });
    console.log(formatDoctorReport(report));
    return true;
  }

  if (command === "docks") {
    console.log(formatDockReport(await dockingStation.report()));
    return true;
  }

  if (command === "dock") {
    const [action, ...parts] = arg.split(/\s+/);
    if (action === "test" && parts.length) {
      console.log(await dockingStation.testDock(parts.join(" ")));
      return true;
    }
    console.log("Usage: /dock test <dock-id>");
    return true;
  }

  if (command === "engine") {
    console.log(JSON.stringify(await getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry, preferenceStore, repoIntelligence, verificationEngine, contextBudgetManager, environmentInspector, capabilityBus, feedbackStore, modelMesh, eventBus, policyStore, workflowStateStore, artifactStore, controlPlane, riskScorer, policyDecisionPoint, runLedger }), null, 2));
    return true;
  }

  if (command === "metrics") {
    console.log(JSON.stringify(await metricsStore.summary(), null, 2));
    return true;
  }

  if (command === "evals") {
    console.log(formatEvalReport(await evalRunner.run({ filter: arg || undefined })));
    return true;
  }

  if (command === "repo") {
    console.log(JSON.stringify(await repoIntelligence.buildMap({ maxFiles: Number(arg || 500) }), null, 2));
    return true;
  }

  if (command === "preferences") {
    console.log(JSON.stringify({
      stats: await preferenceStore.stats(),
      preferences: await preferenceStore.list()
    }, null, 2));
    return true;
  }

  if (command === "preference") {
    const match = arg.match(/^set\s+([a-z0-9._ -]+?)\s*:\s*(.+)$/i);
    if (match) {
      console.log(await preferenceStore.set({ key: match[1].trim(), value: match[2].trim() }));
      return true;
    }
    console.log("Usage: /preference set <key>: <value>");
    return true;
  }

  if (command === "capabilities") {
    console.log(JSON.stringify(capabilityBus.listCapabilities(), null, 2));
    return true;
  }

  if (command === "simulate") {
    console.log(JSON.stringify(await capabilityBus.simulate("shell.run", { command: arg }, { projectRoot }), null, 2));
    return true;
  }

  if (command === "environment") {
    console.log(JSON.stringify(await environmentInspector.inspect(), null, 2));
    return true;
  }

  if (command === "feedback") {
    console.log(JSON.stringify({
      summary: await feedbackStore.summary(),
      events: await feedbackStore.list({ limit: 20 })
    }, null, 2));
    return true;
  }

  if (command === "model-mesh") {
    console.log(JSON.stringify(await modelMesh.route({ taskType: arg || "chat", runtimeProfile: runtimeProfileName, privacyLevel }), null, 2));
    return true;
  }

  if (command === "control") {
    console.log(JSON.stringify(await controlPlane.decide({ message: arg, mode, privacyLevel, runtimeProfile: runtimeProfileName }), null, 2));
    return true;
  }

  if (command === "events") {
    console.log(JSON.stringify({
      summary: await eventBus.summary(),
      events: await eventBus.list({ limit: 20 })
    }, null, 2));
    return true;
  }

  if (command === "policy") {
    console.log(JSON.stringify(await policyStore.getPolicy(), null, 2));
    return true;
  }

  if (command === "policy-decide") {
    console.log(JSON.stringify(await policyDecisionPoint.decide({ action: arg, command: arg, dataSensitivity: privacyLevel === "private" ? "confidential" : "internal" }), null, 2));
    return true;
  }

  if (command === "risk") {
    console.log(JSON.stringify(riskScorer.scoreAction({ action: arg, command: arg, dataSensitivity: privacyLevel === "private" ? "confidential" : "internal" }), null, 2));
    return true;
  }

  if (command === "failure") {
    console.log(JSON.stringify(classifyFailure({ error: arg }), null, 2));
    return true;
  }

  if (command === "ledger") {
    console.log(JSON.stringify({
      summary: await runLedger.summary(),
      records: await runLedger.list({ limit: Number(arg || 20) })
    }, null, 2));
    return true;
  }

  if (command === "replay") {
    console.log(JSON.stringify(await runLedger.replay(arg), null, 2));
    return true;
  }

  if (command === "workflow-state") {
    console.log(JSON.stringify({
      summary: await workflowStateStore.summary(),
      states: await workflowStateStore.list({ limit: 20 })
    }, null, 2));
    return true;
  }

  if (command === "artifacts") {
    console.log(JSON.stringify({
      summary: await artifactStore.summary(),
      artifacts: await artifactStore.list({ limit: 20 })
    }, null, 2));
    return true;
  }

  if (command === "connectors") {
    console.log(JSON.stringify({
      status: await connectorRegistry.status(),
      connectors: await connectorRegistry.listConnectors()
    }, null, 2));
    return true;
  }

  if (command === "connector") {
    const [action, id, url, ...parts] = arg.split(/\s+/);
    if (action === "add" && id && url) {
      console.log(await connectorRegistry.addConnector({
        id,
        url,
        name: parts.join(" ").trim() || id
      }));
      return true;
    }
    if (action === "test" && id) {
      console.log(await connectorRegistry.testConnector(id));
      return true;
    }
    console.log("Usage: /connector add <id> <url> or /connector test <id>");
    return true;
  }

  if (command === "session") {
    const [action, ...parts] = arg.split(/\s+/);
    if (action === "new") {
      activeSession = await sessionStore.createSession({
        title: parts.join(" ").trim() || "Jarvis terminal session",
        mode,
        privacyLevel
      });
      console.log(`Started session ${activeSession.title} (${activeSession.id})`);
      return true;
    }
    if (action === "list") {
      const sessions = await sessionStore.listSessions();
      for (const session of sessions) {
        console.log(`${session.id}  ${session.updated_at}  ${session.messages} messages  ${session.title}`);
      }
      return true;
    }
    if (!arg) {
      console.log(activeSession ? `${activeSession.title} (${activeSession.id})` : "No active session.");
      return true;
    }
    console.log("Usage: /session new <title> or /session list");
    return true;
  }

  if (command === "history") {
    if (!activeSession) {
      console.log("No active session. Use /session new <title> first.");
      return true;
    }
    const session = await sessionStore.getSession(activeSession.id);
    for (const message of session.messages.slice(-20)) {
      console.log(`${message.timestamp} ${message.role}: ${String(message.content || "").slice(0, 500)}`);
    }
    return true;
  }

  if (command === "runs") {
    const runs = await runStore.listRuns({ limit: 10, sessionId: activeSession?.id });
    for (const run of runs) {
      console.log(`${run.id}  ${run.status}  ${run.taskType}/${run.workflow}  ${run.duration_ms ?? "-"}ms  ${run.message.slice(0, 80)}`);
    }
    return true;
  }

  if (command === "mode") {
    if (!arg) {
      console.log(`Current mode: ${mode}`);
      return true;
    }
    mode = arg;
    console.log(`Mode set to ${mode}`);
    return true;
  }

  if (command === "profile" || command === "depth") {
    if (!arg) {
      console.log(`Current runtime profile: ${runtimeProfileName}`);
      console.log(listRuntimeProfiles().map((profile) => `${profile.id}: ${profile.label}, ${profile.verificationLevel} verification, ${profile.latencyBudgetMs}ms budget`).join("\n"));
      return true;
    }
    runtimeProfileName = resolveRuntimeProfile(arg).id;
    console.log(`Runtime profile set to ${runtimeProfileName}`);
    return true;
  }

  if (command === "privacy") {
    if (!arg) {
      console.log(`Current privacy: ${privacyLevel}`);
      return true;
    }
    privacyLevel = arg;
    console.log(`Privacy set to ${privacyLevel}`);
    return true;
  }

  if (command === "ingest") {
    const result = await toolRegistry.execute("memory.ingest", { path: arg || "." }, { projectRoot });
    printToolResult(result);
    return true;
  }

  if (command === "memory") {
    const result = await toolRegistry.execute("memory.query", { query: arg, limit: 5 }, { projectRoot });
    printToolResult(result);
    if (result.matches) {
      for (const match of result.matches) {
        console.log(`- ${match.metadata.source_path} (${match.score.toFixed(3)}) ${match.text.slice(0, 160)}`);
      }
    }
    return true;
  }

  if (command === "memory-stats") {
    console.log(await memoryStore.stats());
    return true;
  }

  if (command === "compact-memory") {
    console.log(await memoryStore.compact());
    return true;
  }

  if (command === "rebuild-memory") {
    console.log(await memoryStore.rebuildIndex(arg || "."));
    return true;
  }

  console.log(`Unknown command: /${command}`);
  return true;
}

function formatProviderStatus(status) {
  const model = status.ollama.configured ? `jarvis-local:${status.ollama.model}` : status.openai.enabled ? `hosted-connector:${status.openai.model}` : "local-draft";
  const search = status.search.configured ? status.search.provider : "search-off";
  const embeddings = status.openaiEmbeddings.enabled ? `hosted-embeddings:${status.openaiEmbeddings.model}` : "local-embeddings";
  return `${model}, ${search}, ${embeddings}`;
}

async function main() {
  activeSession = await sessionStore.createSession({ title: "Jarvis terminal session", mode, privacyLevel });
  printBanner();

  while (true) {
    const answer = await askLine(`\n${mode}> `);
    if (answer === null) break;
    const line = answer.trim();
    if (!line) continue;

    if (line.startsWith("/")) {
      await handleSlashCommand(line);
      continue;
    }

    const session = activeSession ? await sessionStore.getSession(activeSession.id) : null;
    const response = await agent.handleMessage(line, {
      mode,
      privacyLevel,
      runtimeProfile: runtimeProfileName,
      projectRoot,
      sessionId: activeSession?.id,
      sessionHistory: session?.messages || [],
      sessionSummary: session?.compaction?.summary || ""
    });
    if (response.runId) console.log(`Run: ${response.runId}`);
    if (response.workflow) console.log(`Workflow: ${response.workflow.name}`);
    if (response.plan?.length) {
      console.log("Plan:");
      for (const step of response.plan) console.log(`- ${step}`);
    }
    for (const result of response.toolResults ?? []) printToolResult(result);
    console.log("");
    console.log(response.answer);
  }
}

async function askLine(prompt) {
  try {
    return await rl.question(prompt);
  } catch (error) {
    if (error?.code === "ERR_USE_AFTER_CLOSE") return null;
    throw error;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
