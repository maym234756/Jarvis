import { RISK_LEVELS } from "../policy-engine.js";

export class BackendStatusTool {
  constructor(backendSupervisor) {
    this.name = "backend.status";
    this.description = "Show Jarvis backend readiness, service wiring, and dependency topology.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["backend", "readiness", "topology", "observability"];
    this.backendSupervisor = backendSupervisor;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Show backend readiness and topology";
  }

  async run() {
    const report = await this.backendSupervisor.report();
    return {
      summary: `${report.readiness.status}: ${report.summary.ready} ready, ${report.summary.degraded} degraded, ${report.summary.errors} error service(s)`,
      report
    };
  }
}

export class BackendReadinessTool {
  constructor(backendSupervisor) {
    this.name = "backend.ready";
    this.description = "Check whether required Jarvis backend services are ready.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["backend", "readiness", "health"];
    this.backendSupervisor = backendSupervisor;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Check backend readiness";
  }

  async run() {
    const readiness = await this.backendSupervisor.readiness();
    return {
      summary: `${readiness.status}: ${readiness.blocking.length} blocking issue(s)`,
      readiness
    };
  }
}
