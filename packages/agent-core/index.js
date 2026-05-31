import { AgentOrchestrator } from "./agent-orchestrator.js";

export function createAgent(options) {
  return new AgentOrchestrator(options);
}

export { AgentOrchestrator };
