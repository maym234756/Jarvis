export async function getEngineStatus({ modelRouter, reasoningEngine, searchEngine, workflowEngine, metricsStore, memoryStore } = {}) {
  return {
    generated_at: new Date().toISOString(),
    reasoning: {
      available: Boolean(reasoningEngine),
      capabilities: ["task-traits", "evidence-needs", "risk-notes", "answer-contracts", "logic-graph"]
    },
    search: {
      available: Boolean(searchEngine),
      capabilities: ["query-planning", "dedupe", "source-ranking", "fetch", "snippet-extraction", "citations"],
      cache: searchEngine?.cacheStatus ? searchEngine.cacheStatus() : null
    },
    memory: {
      cache: memoryStore?.cacheStatus ? memoryStore.cacheStatus() : null
    },
    metrics: metricsStore ? await metricsStore.summary() : null,
    modelRouter: modelRouter?.describe ? modelRouter.describe({ privacyLevel: "project" }) : null,
    workflows: workflowEngine?.list ? workflowEngine.list().map((workflow) => workflow.name) : []
  };
}
