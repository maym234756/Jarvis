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

const projectRoot = process.cwd();
loadEnv({ cwd: projectRoot });
const rl = readline.createInterface({ input, output });

let mode = "agent";
let privacyLevel = "project";
let activeSession = null;

function printBanner() {
  console.log("Jarvis AI Platform MVP");
  console.log(`Workspace: ${projectRoot}`);
  console.log(`Providers: ${formatProviderStatus(getProviderStatus())}`);
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
const modelRouter = new ModelRouter();
const workflowEngine = new WorkflowEngine();
const reasoningEngine = new ReasoningEngine();
const searchEngine = new SearchEngine();
const toolRegistry = createDefaultToolRegistry({
  projectRoot,
  memoryStore,
  approvalProvider: askApproval,
  searchEngine,
  metricsStore,
  connectorRegistry
});
const evalRunner = new BackendEvalRunner({ projectRoot, toolRegistry, memoryStore, searchEngine });
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
const dockingStation = new BackendDockingStation({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, connectorRegistry, evalRunner });
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
    const report = await runDoctor({ projectRoot, memoryStore, toolRegistry, runStore, sessionStore, dockingStation, evalRunner });
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
    console.log(JSON.stringify(await getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry }), null, 2));
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
  const model = status.openai.configured ? `openai:${status.openai.model}` : status.ollama.configured ? `ollama:${status.ollama.model}` : "local-draft";
  const search = status.search.configured ? status.search.provider : "search-off";
  const embeddings = status.openaiEmbeddings.configured ? `embeddings:${status.openaiEmbeddings.model}` : "local-embeddings";
  return `${model}, ${search}, ${embeddings}`;
}

async function main() {
  activeSession = await sessionStore.createSession({ title: "Jarvis terminal session", mode, privacyLevel });
  printBanner();

  while (true) {
    const line = (await rl.question(`\n${mode}> `)).trim();
    if (!line) continue;

    if (line.startsWith("/")) {
      await handleSlashCommand(line);
      continue;
    }

    const session = activeSession ? await sessionStore.getSession(activeSession.id) : null;
    const response = await agent.handleMessage(line, {
      mode,
      privacyLevel,
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

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
