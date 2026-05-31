import { RISK_LEVELS } from "../policy-engine.js";

export class ArtifactListTool {
  constructor(artifactStore) {
    this.name = "artifact.list";
    this.description = "List Jarvis generated artifacts.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["artifacts", "reports", "outputs"];
    this.artifactStore = artifactStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `List ${args.limit || 20} artifacts`;
  }

  async run(args = {}) {
    const artifacts = await this.artifactStore.list({ limit: args.limit || 20, type: args.type });
    return {
      summary: `${artifacts.length} artifact(s)`,
      artifacts
    };
  }
}
