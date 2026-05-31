export class RunLedgerListTool {
  constructor(runLedger) {
    this.name = "run.ledger";
    this.description = "List and summarize replayable Jarvis run ledger records.";
    this.riskLevel = 0;
    this.capabilities = ["run-ledger", "replay", "audit"];
    this.runLedger = runLedger;
  }

  async assessRisk() {
    return 0;
  }

  summarize(args = {}) {
    return `List run ledger records (${args.limit || 20})`;
  }

  async run(args = {}) {
    return {
      summary: "Run ledger records loaded.",
      ledger: await this.runLedger.summary(),
      records: await this.runLedger.list({ limit: args.limit || 20, status: args.status })
    };
  }
}

export class RunReplayTool {
  constructor(runLedger) {
    this.name = "run.replay";
    this.description = "Load replay data for a Jarvis run: input, decisions, memory, tools, artifacts, and final response.";
    this.riskLevel = 0;
    this.capabilities = ["run-replay", "audit", "debugging"];
    this.runLedger = runLedger;
  }

  async assessRisk() {
    return 0;
  }

  summarize(args = {}) {
    return `Replay run ${args.runId || args.id || ""}`.trim();
  }

  async run(args = {}) {
    const runId = args.runId || args.id;
    if (!runId) throw new Error("runId is required.");
    const replay = await this.runLedger.replay(runId);
    return {
      summary: `Replay loaded for ${runId}`,
      replay
    };
  }
}
