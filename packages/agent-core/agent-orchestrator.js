import { classifyTask, createPlan, parseToolIntent } from "./planner.js";
import { ReasoningEngine } from "../reasoning/index.js";

export class AgentOrchestrator {
  constructor({ projectRoot, modelRouter, toolRegistry, memoryStore, workflowEngine, runStore, sessionStore, reasoningEngine }) {
    this.projectRoot = projectRoot;
    this.modelRouter = modelRouter;
    this.toolRegistry = toolRegistry;
    this.memoryStore = memoryStore;
    this.workflowEngine = workflowEngine;
    this.runStore = runStore;
    this.sessionStore = sessionStore;
    this.reasoningEngine = reasoningEngine || new ReasoningEngine();
  }

  async handleMessage(message, context = {}) {
    const taskType = classifyTask(message, context.mode);
    const plan = createPlan(message, taskType);
    const workflow = this.workflowEngine.select(taskType);
    const intent = parseToolIntent(message);
    const run = this.runStore ? await this.runStore.startRun({
      message,
      mode: context.mode || "agent",
      privacyLevel: context.privacyLevel || "project",
      sessionId: context.sessionId,
      taskType,
      workflow
    }) : null;

    if (this.sessionStore && context.sessionId) {
      await this.sessionStore.appendMessage(context.sessionId, {
        role: "user",
        content: message,
        mode: context.mode || "agent",
        privacyLevel: context.privacyLevel || "project"
      });
    }

    const memoryContext = await this.memoryStore.query(message, { limit: 4 });
    const relevantTools = this.toolRegistry.searchTools
      ? this.toolRegistry.searchTools(message, { limit: 6 })
      : this.toolRegistry.listTools?.().slice(0, 6) || [];
    const reasoningFrame = this.reasoningEngine.buildFrame({
      message,
      taskType,
      workflow,
      plan,
      memoryContext,
      toolIntent: intent,
      context
    });
    const toolResults = [];
    let answer = "";

    try {
      if (intent) {
        const result = await this.toolRegistry.execute(intent.tool, intent.args, {
          projectRoot: this.projectRoot,
          mode: context.mode,
          privacyLevel: context.privacyLevel
        });
        toolResults.push(result);
      } else if (taskType === "research") {
        const result = await this.toolRegistry.execute("research.run", { query: message, limit: 5, maxSources: 3 }, {
          projectRoot: this.projectRoot,
          mode: context.mode,
          privacyLevel: context.privacyLevel
        });
        toolResults.push(result);
      }

      answer = await this.modelRouter.generate({
        message,
        taskType,
        plan,
        workflow,
        memoryContext,
        toolResults,
        reasoningFrame,
        relevantTools,
        sessionHistory: context.sessionHistory || [],
        sessionSummary: context.sessionSummary || "",
        privacyLevel: context.privacyLevel || "project"
      });

      if (this.sessionStore && context.sessionId) {
        await this.sessionStore.appendMessage(context.sessionId, {
          role: "assistant",
          content: answer,
          runId: run?.id || null,
          toolResults: toolResults.map((result) => ({
            tool: result.tool,
            ok: result.ok,
            pendingApproval: result.pendingApproval || false,
            approvalId: result.approvalId || null,
            summary: result.summary,
            error: result.error
          }))
        });
      }

      if (this.runStore && run) {
        await this.runStore.completeRun(run.id, {
          tool_count: toolResults.length,
          pending_approvals: toolResults.filter((result) => result.pendingApproval).length,
          confidence: reasoningFrame.confidence
        });
      }

      return {
        ok: true,
        runId: run?.id || null,
        sessionId: context.sessionId || null,
        taskType,
        workflow,
        plan,
        reasoningFrame,
        memoryContext,
        relevantTools,
        toolResults,
        answer
      };
    } catch (error) {
      if (this.runStore && run) {
        await this.runStore.completeRun(run.id, { error: error.message, tool_count: toolResults.length });
      }
      throw error;
    }
  }
}
