import { RISK_LEVELS } from "../policy-engine.js";

export class RepoMapTool {
  constructor(repoIntelligence) {
    this.name = "repo.map";
    this.description = "Build a repository intelligence map with files, symbols, package scripts, and test hints.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["repo-intelligence", "file-map", "symbol-index", "test-map"];
    this.repoIntelligence = repoIntelligence;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args = {}) {
    return `Build repo map${args.maxFiles ? ` for up to ${args.maxFiles} files` : ""}`;
  }

  async run(args = {}) {
    const map = await this.repoIntelligence.buildMap({ maxFiles: args.maxFiles || 500 });
    return {
      summary: `${map.summary.files} file(s), ${map.symbols.length} symbol(s), ${map.tests.files.length} test file(s)`,
      map
    };
  }
}
