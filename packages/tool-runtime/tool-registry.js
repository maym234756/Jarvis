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
      riskLevel: tool.riskLevel,
      capabilities: tool.capabilities || []
    }));
  }

  searchTools(query = "", { limit = 8 } = {}) {
    const text = normalize(query);
    const queryTerms = terms(text);
    const tools = this.listTools().map((tool) => {
      const haystack = normalize([
        tool.name,
        tool.description,
        tool.riskLevel,
        ...(tool.capabilities || [])
      ].join(" "));
      const matchedTerms = queryTerms.filter((term) => haystack.includes(term));
      const exactName = text && tool.name.toLowerCase().includes(text) ? 3 : 0;
      const nameHits = queryTerms.filter((term) => tool.name.toLowerCase().includes(term)).length;
      const descriptionHits = queryTerms.filter((term) => String(tool.description || "").toLowerCase().includes(term)).length;
      const coverage = queryTerms.length ? matchedTerms.length / queryTerms.length : 0;
      const score = Number((coverage * 4 + exactName + nameHits * 1.5 + descriptionHits * 0.75).toFixed(4));
      return {
        ...tool,
        score,
        matchedTerms: [...new Set(matchedTerms)]
      };
    });

    return tools
      .filter((tool) => !queryTerms.length || tool.score > 0)
      .sort((a, b) => b.score - a.score || a.riskLevel - b.riskLevel || a.name.localeCompare(b.name))
      .slice(0, limit);
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

    if (decision.requiresApproval && !bypassApproval && !isAutoApprovedReadOnlyNetwork(name, context)) {
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

function isAutoApprovedReadOnlyNetwork(toolName, context = {}) {
  return Boolean(context.autoApproveReadOnlyNetwork)
    && (toolName === "search.web" || toolName === "research.run")
    && !/^(0|false|no)$/i.test(process.env.JARVIS_AUTO_WEB_RESEARCH || "true");
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function terms(value = "") {
  return (normalize(value).match(/[a-z0-9][a-z0-9._-]*/g) || [])
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));
}

const STOPWORDS = new Set(["the", "and", "for", "with", "into", "from", "this", "that", "what", "which"]);
