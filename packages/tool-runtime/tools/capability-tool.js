import { RISK_LEVELS } from "../policy-engine.js";

export class CapabilityListTool {
  constructor(capabilityBus) {
    this.name = "capability.list";
    this.description = "List Jarvis tool capabilities with safe execution contracts.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["capability-bus", "tool-contracts", "docking-station"];
    this.capabilityBus = capabilityBus;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "List capability contracts";
  }

  async run() {
    const capabilities = this.capabilityBus.listCapabilities();
    return {
      summary: `${capabilities.length} capability contract(s)`,
      capabilities
    };
  }
}

export class CapabilitySearchTool {
  constructor(capabilityBus) {
    this.name = "capability.search";
    this.description = "Search Jarvis capability contracts for the safest relevant tool surface.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["capability-search", "tool-contracts"];
    this.capabilityBus = capabilityBus;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Search capabilities for "${args.query || ""}"`;
  }

  async run(args) {
    const capabilities = this.capabilityBus.search(args.query || "", { limit: args.limit || 8 });
    return {
      summary: `${capabilities.length} matching capability contract(s)`,
      capabilities
    };
  }
}

export class CapabilitySimulateTool {
  constructor(capabilityBus) {
    this.name = "capability.simulate";
    this.description = "Simulate a tool call before execution to show risk, policy decision, and expected effects.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["tool-simulation", "risk-preview", "policy-preview"];
    this.capabilityBus = capabilityBus;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Simulate ${args.tool}`;
  }

  async run(args, context) {
    if (!args.tool) throw new Error("tool is required");
    const simulation = await this.capabilityBus.simulate(args.tool, args.args || {}, context);
    return {
      summary: `${args.tool}: ${simulation.decision?.reason || simulation.error || "simulated"}`,
      simulation
    };
  }
}
