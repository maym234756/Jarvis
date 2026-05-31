import { SearchEngine } from "../../search/index.js";
import { RISK_LEVELS } from "../policy-engine.js";

export class SearchWebTool {
  constructor({ searchEngine } = {}) {
    this.name = "search.web";
    this.description = "Search the web through a configured provider with ranking and dedupe.";
    this.riskLevel = RISK_LEVELS.NETWORK_OR_PACKAGE;
    this.searchEngine = searchEngine || new SearchEngine();
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Search web for "${args.query}"`;
  }

  async run(args) {
    if (!args.query) throw new Error("query is required");
    return this.searchEngine.search(args.query, {
      limit: args.limit || 5,
      maxQueries: args.maxQueries || 3
    });
  }
}

export class ResearchRunTool {
  constructor({ searchEngine } = {}) {
    this.name = "research.run";
    this.description = "Plan search queries, rank sources, fetch top pages, and extract citations.";
    this.riskLevel = RISK_LEVELS.NETWORK_OR_PACKAGE;
    this.searchEngine = searchEngine || new SearchEngine();
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Research "${args.query}"`;
  }

  async run(args) {
    if (!args.query) throw new Error("query is required");
    return this.searchEngine.research(args.query, {
      limit: args.limit || 8,
      maxQueries: args.maxQueries || 3,
      maxSources: args.maxSources || 4
    });
  }
}

export async function runWebSearch(query, options = {}) {
  return new SearchEngine().search(query, options);
}
