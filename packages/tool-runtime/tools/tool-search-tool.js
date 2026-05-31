import { RISK_LEVELS } from "../policy-engine.js";

export class ToolSearchTool {
  constructor(toolRegistry) {
    this.name = "tool.search";
    this.description = "Find the most relevant Jarvis tools for a request without loading every tool into the prompt.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["tool-discovery", "capability-routing", "prompt-budgeting"];
    this.toolRegistry = toolRegistry;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Search tools for "${args.query || ""}"`;
  }

  async run(args) {
    const tools = this.toolRegistry.searchTools(args.query || "", {
      limit: Number(args.limit || 8)
    });
    return {
      summary: `${tools.length} relevant tool(s)`,
      tools
    };
  }
}
