import { RISK_LEVELS } from "../policy-engine.js";

export class EventSummaryTool {
  constructor(eventBus) {
    this.name = "events.summary";
    this.description = "Summarize Jarvis backend event stream.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["events", "observability"];
    this.eventBus = eventBus;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Summarize backend events";
  }

  async run() {
    const summary = await this.eventBus.summary();
    return {
      summary: `${summary.total} event(s) recorded`,
      events: summary
    };
  }
}

export class EventListTool {
  constructor(eventBus) {
    this.name = "events.list";
    this.description = "List recent Jarvis backend events.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["events", "observability"];
    this.eventBus = eventBus;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `List ${args.limit || 20} backend events`;
  }

  async run(args = {}) {
    const events = await this.eventBus.list({ limit: args.limit || 20, type: args.type });
    return {
      summary: `${events.length} event(s)`,
      events
    };
  }
}
