export async function getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore, connectorRegistry, evalRunner, toolRegistry } = {}) {
  return {
    generated_at: new Date().toISOString(),
    reasoning: {
      available: Boolean(reasoningEngine),
      capabilities: ["task-traits", "evidence-needs", "risk-notes", "answer-contracts", "logic-graph"]
    },
    search: {
      available: Boolean(searchEngine),
      capabilities: ["query-planning", "dedupe", "source-ranking", "fetch", "snippet-extraction", "citations", "prompt-injection-scan"],
      cache: searchEngine?.cacheStatus ? searchEngine.cacheStatus() : null
    },
    tools: {
      count: toolRegistry?.listTools ? toolRegistry.listTools().length : 0,
      capabilities: ["tool-search", "risk-routing", "approval-gates"]
    },
    connectors: connectorRegistry ? await connectorRegistry.status() : null,
    evals: evalRunner ? await evalRunner.run() : null,
    memory: {
      cache: memoryStore?.cacheStatus ? memoryStore.cacheStatus() : null
    },
    metrics: metricsStore ? await metricsStore.summary() : null,
    modelRouter: modelRouter?.describe ? modelRouter.describe({ privacyLevel: "project" }) : null,
    workflows: workflowEngine?.list ? workflowEngine.list().map((workflow) => workflow.name) : []
  };
}
