import { RISK_LEVELS } from "../policy-engine.js";

export class ModelMeshRouteTool {
  constructor(modelMesh) {
    this.name = "modelmesh.route";
    this.description = "Preview model mesh role routing for a task.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["model-mesh", "routing", "role-selection"];
    this.modelMesh = modelMesh;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Route ${args.taskType || "chat"} task`;
  }

  async run(args = {}) {
    const route = await this.modelMesh.route(args);
    return {
      summary: `${route.taskType} -> ${route.primaryRole} (${route.profile})`,
      route
    };
  }
}
