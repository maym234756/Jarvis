export class ToolRegistry {
  constructor({ projectRoot, policyEngine, auditLogger, approvalProvider, approvalQueue, metricsStore } = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.policyEngine = policyEngine;
    this.auditLogger = auditLogger;
    this.approvalProvider = approvalProvider;
    this.approvalQueue = approvalQueue;
    this.metricsStore = metricsStore;
    this.tools = new Map();
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  listTools() {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel
    }));
  }

  async execute(name, args = {}, context = {}) {
    return this.#execute(name, args, context);
  }

  async approve(id, { approved, note } = {}) {
    if (!this.approvalQueue) throw new Error("Approval queue is not configured.");
    const item = await this.approvalQueue.resolve(id, { approved, note });
    if (!approved) {
      const denied = {
        ok: false,
        tool: item.tool,
        riskLevel: item.riskLevel,
        summary: item.summary,
        error: "Approval denied."
      };
      await this.auditLogger.write({ type: "tool_denied", approvalId: id, ...denied });
      return denied;
    }

    await this.auditLogger.write({
      type: "tool_approved",
      approvalId: id,
      tool: item.tool,
      riskLevel: item.riskLevel,
      summary: item.summary
    });

    const result = await this.#execute(item.tool, item.args, item.context, { bypassApproval: true, approvalId: id });
    await this.approvalQueue.complete(id, result);
    return result;
  }

  async #execute(name, args = {}, context = {}, { bypassApproval = false, approvalId = null } = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, tool: name, error: `Unknown tool: ${name}` };
    }

    const startedAt = Date.now();
    const riskLevel = await tool.assessRisk(args, context);
    const summary = tool.summarize(args);
    const decision = this.policyEngine.evaluate({ toolName: name, riskLevel, summary });

    if (!decision.allowed) {
      const blocked = {
        ok: false,
        tool: name,
        riskLevel,
        summary,
        error: decision.reason
      };
      await this.auditLogger.write({ type: "tool_blocked", ...blocked });
      return blocked;
    }

    if (decision.requiresApproval && !bypassApproval) {
      if (!this.approvalProvider) {
        const queued = this.approvalQueue
          ? await this.approvalQueue.create({
            tool: name,
            args,
            context: { ...context, projectRoot: context.projectRoot || this.projectRoot },
            riskLevel,
            summary,
            reason: decision.reason
          })
          : null;
        const pending = {
          ok: false,
          tool: name,
          riskLevel,
          summary,
          pendingApproval: true,
          reason: decision.reason,
          approvalId: queued?.id
        };
        await this.auditLogger.write({ type: "tool_pending_approval", approvalId: queued?.id, ...pending });
        return pending;
      }

      const approved = await this.approvalProvider(decision);
      if (!approved) {
        const denied = {
          ok: false,
          tool: name,
          riskLevel,
          summary,
          error: "User denied approval."
        };
        await this.auditLogger.write({ type: "tool_denied", ...denied });
        return denied;
      }
    }

    await this.auditLogger.write({
      type: "tool_started",
      approvalId,
      tool: name,
      riskLevel,
      summary,
      cwd: context.projectRoot || this.projectRoot
    });

    try {
      const result = await tool.run(args, { ...context, projectRoot: context.projectRoot || this.projectRoot });
      const durationMs = Date.now() - startedAt;
      const completed = { ok: true, tool: name, riskLevel, summary, duration_ms: durationMs, ...result };
      await this.auditLogger.write({
        type: "tool_completed",
        approvalId,
        tool: name,
        riskLevel,
        summary,
        resultSummary: completed.summary,
        duration_ms: durationMs
      });
      await this.metricsStore?.record({
        type: "tool",
        tool: name,
        ok: true,
        riskLevel,
        duration_ms: durationMs
      });
      return completed;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const failed = { ok: false, tool: name, riskLevel, summary, error: error.message, duration_ms: durationMs };
      await this.auditLogger.write({ type: "tool_failed", approvalId, ...failed });
      await this.metricsStore?.record({
        type: "tool",
        tool: name,
        ok: false,
        riskLevel,
        duration_ms: durationMs,
        error: error.message
      });
      return failed;
    }
  }
}
