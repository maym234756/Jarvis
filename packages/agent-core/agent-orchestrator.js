import { classifyTask, createPlan, parseToolIntent } from "./planner.js";
import { ReasoningEngine } from "../reasoning/index.js";
import { resolveRuntimeProfile } from "../runtime/index.js";
import { VerificationEngine } from "../verification/index.js";
import { chooseResponseMode } from "../response/index.js";
import { composeGroundedAnswer } from "../answers/index.js";

export class AgentOrchestrator {
  constructor({ projectRoot, modelRouter, toolRegistry, memoryStore, workflowEngine, runStore, sessionStore, reasoningEngine, verificationEngine, preferenceStore, contextBudgetManager, feedbackStore, modelMesh, eventBus, workflowStateStore, artifactStore, riskScorer, policyDecisionPoint, runLedger }) {
    this.projectRoot = projectRoot;
    this.modelRouter = modelRouter;
    this.toolRegistry = toolRegistry;
    this.memoryStore = memoryStore;
    this.workflowEngine = workflowEngine;
    this.runStore = runStore;
    this.sessionStore = sessionStore;
    this.reasoningEngine = reasoningEngine || new ReasoningEngine();
    this.verificationEngine = verificationEngine || new VerificationEngine();
    this.preferenceStore = preferenceStore;
    this.contextBudgetManager = contextBudgetManager;
    this.feedbackStore = feedbackStore;
    this.modelMesh = modelMesh;
    this.eventBus = eventBus;
    this.workflowStateStore = workflowStateStore;
    this.artifactStore = artifactStore;
    this.riskScorer = riskScorer;
    this.policyDecisionPoint = policyDecisionPoint;
    this.runLedger = runLedger;
  }

  async handleMessage(message, context = {}) {
    const runtimeProfile = resolveRuntimeProfile(context.runtimeProfile || context.depth || "balanced");
    const taskType = classifyTask(message, context.mode);
    const plan = createPlan(message, taskType);
    const workflow = this.workflowEngine.select(taskType);
    const intent = parseToolIntent(message);
    const responseMode = chooseResponseMode({ message, taskType, toolIntent: intent, runtimeProfile });
    const modelMeshRoute = this.modelMesh ? await this.modelMesh.route({
      taskType,
      privacyLevel: context.privacyLevel || "project",
      runtimeProfile,
      toolIntent: intent
    }) : null;
    const runRisk = this.riskScorer ? this.riskScorer.scoreAction({
      action: message,
      tool: intent?.tool,
      args: intent?.args || {},
      workflowType: workflow?.name,
      dataSensitivity: context.privacyLevel === "private" ? "confidential" : "internal"
    }) : null;
    const policyDecision = this.policyDecisionPoint ? await this.policyDecisionPoint.decide({
      action: message,
      tool: intent?.tool,
      args: intent?.args || {},
      workflowType: workflow?.name,
      dataSensitivity: context.privacyLevel === "private" ? "confidential" : "internal"
    }) : null;
    const run = this.runStore ? await this.runStore.startRun({
      message,
      mode: context.mode || "agent",
      privacyLevel: context.privacyLevel || "project",
      sessionId: context.sessionId,
      taskType,
      workflow
    }) : null;
    if (run?.id && this.runLedger) {
      await this.runLedger.start({
        runId: run.id,
        userGoal: message,
        workflow,
        taskType,
        modelRoute: modelMeshRoute,
        riskLevel: runRisk?.level || "unknown"
      });
      await this.runLedger.appendEvent(run.id, "decision", {
        taskType,
        workflow: workflow?.name || null,
        plan,
        responseMode: responseMode.id,
        runtimeProfile: runtimeProfile.id,
        modelRoute: modelMeshRoute,
        risk: runRisk,
        policyDecision
      });
    }
    await this.eventBus?.publish("user.message.received", {
      runId: run?.id || null,
      taskType,
      mode: context.mode || "agent",
      privacyLevel: context.privacyLevel || "project"
    });
    if (run?.id && this.workflowStateStore) {
      await this.workflowStateStore.create({ runId: run.id, workflow, goal: message, taskType });
      await this.workflowStateStore.transition(run.id, "CONTEXT_GATHERING", { note: "Gathering memory and context", currentStep: "retrieve-memory" });
    }

    if (this.sessionStore && context.sessionId) {
      await this.sessionStore.appendMessage(context.sessionId, {
        role: "user",
        content: message,
        mode: context.mode || "agent",
        privacyLevel: context.privacyLevel || "project"
      });
    }

    const memoryContext = await this.memoryStore.query(message, { limit: 4 });
    if (run?.id && this.runLedger) {
      await this.runLedger.appendEvent(run.id, "memory.read", {
        query: message,
        matches: memoryContext.map((match) => ({
          id: match.id || null,
          source: match.metadata?.source_path || match.citation?.label || null,
          score: match.score
        }))
      });
    }
    const userPreferences = this.preferenceStore ? await this.preferenceStore.effective() : {};
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
    let verificationReport = null;
    let contextBudget = null;
    let answer = "";

    try {
      if (intent) {
        if (run?.id && this.workflowStateStore) {
          await this.workflowStateStore.transition(run.id, "EXECUTING", { note: `Executing ${intent.tool}`, currentStep: intent.tool, tool: intent.tool });
        }
        await this.eventBus?.publish("tool.called", { runId: run?.id || null, tool: intent.tool, args: safeArgs(intent.args) });
        await this.runLedger?.appendEvent(run?.id, "tool.called", { tool: intent.tool, args: safeArgs(intent.args) });
        const result = await this.toolRegistry.execute(intent.tool, intent.args, {
          projectRoot: this.projectRoot,
          mode: context.mode,
          privacyLevel: context.privacyLevel,
          autoApproveReadOnlyNetwork: isReadOnlyResearchTool(intent.tool)
        });
        toolResults.push(result);
        await this.eventBus?.publish(result.pendingApproval ? "approval.requested" : "tool.completed", {
          runId: run?.id || null,
          tool: intent.tool,
          ok: result.ok,
          pendingApproval: result.pendingApproval || false
        });
        await this.runLedger?.appendEvent(run?.id, result.pendingApproval ? "approval.requested" : "tool.completed", summarizeToolResult(result));
      } else if (taskType === "research") {
        if (run?.id && this.workflowStateStore) {
          await this.workflowStateStore.transition(run.id, "EXECUTING", { note: "Executing research.run", currentStep: "research.run", tool: "research.run" });
        }
        await this.eventBus?.publish("tool.called", { runId: run?.id || null, tool: "research.run", args: { query: message } });
        await this.runLedger?.appendEvent(run?.id, "tool.called", { tool: "research.run", args: { query: message } });
        const result = await this.toolRegistry.execute("research.run", { query: message, limit: 8, maxQueries: 5, maxSources: 5 }, {
          projectRoot: this.projectRoot,
          mode: context.mode,
          privacyLevel: context.privacyLevel,
          autoApproveReadOnlyNetwork: true
        });
        toolResults.push(result);
        await this.eventBus?.publish(result.pendingApproval ? "approval.requested" : "tool.completed", {
          runId: run?.id || null,
          tool: "research.run",
          ok: result.ok,
          pendingApproval: result.pendingApproval || false
        });
        await this.runLedger?.appendEvent(run?.id, result.pendingApproval ? "approval.requested" : "tool.completed", summarizeToolResult(result));
      }
      if (run?.id && this.workflowStateStore) {
        const current = await this.workflowStateStore.get(run.id);
        if (!["EXECUTING", "NEEDS_USER_APPROVAL"].includes(current.status)) {
          await this.workflowStateStore.transition(run.id, "PLAN_READY", { note: "Plan ready", currentStep: "respond" });
        }
        const afterPlan = await this.workflowStateStore.get(run.id);
        if (afterPlan.status === "EXECUTING") {
          await this.workflowStateStore.transition(run.id, "VERIFYING", { note: "Verifying tool results", currentStep: "verify" });
        } else if (afterPlan.status === "PLAN_READY") {
          await this.workflowStateStore.transition(run.id, "EXECUTING", { note: "No tool execution needed", currentStep: "compose" });
          await this.workflowStateStore.transition(run.id, "VERIFYING", { note: "Verifying response", currentStep: "verify" });
        }
      }

      verificationReport = this.verificationEngine.verify({
        message,
        taskType,
        plan,
        toolResults,
        memoryContext,
        reasoningFrame,
        responseMode,
        runtimeProfile
      });
      await this.runLedger?.appendEvent(run?.id, "verification", {
        status: verificationReport.status,
        confidence: verificationReport.confidence,
        summary: verificationReport.summary
      });
      contextBudget = this.contextBudgetManager ? this.contextBudgetManager.allocate({
        message,
        taskType,
        runtimeProfile,
        sessionHistory: context.sessionHistory || [],
        memoryContext,
        toolResults
      }) : null;

      const answerRequest = {
        message,
        taskType,
        plan,
        workflow,
        memoryContext,
        toolResults,
        reasoningFrame,
        relevantTools,
        verificationReport,
        contextBudget,
        responseMode,
        runtimeProfile,
        modelMeshRoute,
        userPreferences,
        sessionHistory: context.sessionHistory || [],
        sessionSummary: context.sessionSummary || "",
        privacyLevel: context.privacyLevel || "project"
      };

      answer = composeGroundedAnswer(answerRequest) || await this.modelRouter.generate(answerRequest);

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
          })),
          verification: verificationReport ? {
            status: verificationReport.status,
            confidence: verificationReport.confidence,
            summary: verificationReport.summary
          } : null
        });
      }
      if (run?.id && this.artifactStore) {
        const artifact = await this.artifactStore.create({
          type: "markdown",
          title: `Jarvis answer ${run.id}`,
          content: answer,
          sourceTask: run.id,
          verified: verificationReport?.status !== "fail",
          metadata: {
            taskType,
            workflow: workflow?.name || null,
            confidence: verificationReport?.confidence || null
          }
        });
        await this.runLedger?.appendEvent(run.id, "artifact.created", {
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          verified: artifact.verified
        });
      }

      if (this.runStore && run) {
        await this.runStore.completeRun(run.id, {
          tool_count: toolResults.length,
          pending_approvals: toolResults.filter((result) => result.pendingApproval).length,
          confidence: verificationReport?.confidence || reasoningFrame.confidence
        });
      }
      await this.runLedger?.complete(run?.id, {
        status: verificationReport?.status === "fail" ? "failed" : "completed",
        final_response: answer,
        risk_level: runRisk?.level || "unknown",
        verification: verificationReport ? {
          status: verificationReport.status,
          confidence: verificationReport.confidence,
          summary: verificationReport.summary
        } : null
      });
      if (run?.id && this.workflowStateStore) {
        await this.workflowStateStore.transition(run.id, verificationReport?.status === "fail" ? "FAILED" : "COMPLETE", {
          note: verificationReport?.summary || "completed",
          currentStep: "complete",
          error: verificationReport?.status === "fail" ? verificationReport.summary : null
        });
      }
      await this.eventBus?.publish("workflow.completed", {
        runId: run?.id || null,
        taskType,
        status: verificationReport?.status || "unknown",
        confidence: verificationReport?.confidence || null
      });
      await this.feedbackStore?.record({
        source: "system",
        taskType,
        workflow: workflow?.name || null,
        runtimeProfile: runtimeProfile.id,
        modelProvider: modelMeshRoute?.primaryRole || null,
        ok: verificationReport?.status !== "fail",
        score: verificationReport?.status === "ok" ? 1 : verificationReport?.status === "warn" ? 0.6 : 0,
        labels: ["agent-run", verificationReport?.status || "unknown"],
        metadata: {
          runId: run?.id || null,
          tool_count: toolResults.length,
          pending_approvals: toolResults.filter((result) => result.pendingApproval).length
        }
      });

      return {
        ok: true,
        runId: run?.id || null,
        sessionId: context.sessionId || null,
        taskType,
        workflow,
        plan,
        reasoningFrame,
        responseMode,
        runtimeProfile,
        verificationReport,
        contextBudget,
        modelMeshRoute,
        runRisk,
        policyDecision,
        userPreferences,
        memoryContext,
        relevantTools,
        toolResults,
        answer
      };
    } catch (error) {
      if (this.runStore && run) {
        await this.runStore.completeRun(run.id, { error: error.message, tool_count: toolResults.length });
      }
      if (run?.id && this.workflowStateStore) {
        try {
          const state = await this.workflowStateStore.get(run.id);
          if (!["FAILED", "COMPLETE"].includes(state.status)) {
            await this.workflowStateStore.transition(run.id, "FAILED", { note: "Unhandled agent error", error: error.message });
          }
        } catch {}
      }
      await this.eventBus?.publish("workflow.failed", { runId: run?.id || null, taskType, error: error.message });
      await this.runLedger?.complete(run?.id, {
        status: "failed",
        error: error.message,
        failure: { message: error.message }
      });
      await this.feedbackStore?.record({
        source: "system",
        taskType,
        workflow: workflow?.name || null,
        runtimeProfile: runtimeProfile.id,
        modelProvider: modelMeshRoute?.primaryRole || null,
        ok: false,
        score: 0,
        labels: ["agent-run", "exception"],
        note: error.message,
        metadata: { runId: run?.id || null }
      });
      throw error;
    }
  }
}

function safeArgs(args = {}) {
  const copy = { ...args };
  for (const key of Object.keys(copy)) {
    if (/secret|token|key|password/i.test(key)) copy[key] = "[redacted]";
  }
  return copy;
}

function summarizeToolResult(result = {}) {
  return {
    tool: result.tool,
    ok: result.ok,
    pendingApproval: result.pendingApproval || false,
    approvalId: result.approvalId || null,
    riskLevel: result.riskLevel,
    summary: result.summary,
    error: result.error,
    duration_ms: result.duration_ms
  };
}

function isReadOnlyResearchTool(toolName) {
  return toolName === "search.web" || toolName === "research.run";
}
