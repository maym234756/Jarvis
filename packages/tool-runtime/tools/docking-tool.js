import { RISK_LEVELS } from "../policy-engine.js";

export class DockingStatusTool {
  constructor(dockingStation) {
    this.name = "docking.status";
    this.description = "Show Backend Docking Station status.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.dockingStation = dockingStation;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Show backend docking station status";
  }

  async run() {
    const report = await this.dockingStation.report();
    return {
      summary: `${report.summary.ok} ok, ${report.summary.warn} warning, ${report.summary.error} error dock(s)`,
      report
    };
  }
}

export class DockingTestTool {
  constructor(dockingStation) {
    this.name = "docking.test";
    this.description = "Test one Backend Docking Station dock.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.dockingStation = dockingStation;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Test dock ${args.id}`;
  }

  async run(args) {
    if (!args.id) throw new Error("id is required");
    const result = await this.dockingStation.testDock(args.id);
    return {
      summary: `${args.id}: ${result.message || result.status}`,
      result
    };
  }
}
