import { RISK_LEVELS } from "../policy-engine.js";

export class FeedbackRecordTool {
  constructor(feedbackStore) {
    this.name = "feedback.record";
    this.description = "Record user or system feedback for Jarvis learning-loop evaluation.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
    this.capabilities = ["feedback", "learning-loop", "outcome-tracking"];
    this.feedbackStore = feedbackStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Record feedback for ${args.taskType || "unknown"}`;
  }

  async run(args = {}) {
    const event = await this.feedbackStore.record({ ...args, source: args.source || "user" });
    return {
      summary: `Recorded feedback ${event.id}`,
      event
    };
  }
}

export class FeedbackSummaryTool {
  constructor(feedbackStore) {
    this.name = "feedback.summary";
    this.description = "Summarize Jarvis feedback and route outcome history.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
    this.capabilities = ["feedback", "learning-loop", "routing-outcomes"];
    this.feedbackStore = feedbackStore;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize() {
    return "Summarize feedback";
  }

  async run() {
    const summary = await this.feedbackStore.summary();
    return {
      summary: `${summary.total} feedback event(s), success rate ${summary.successRate ?? "n/a"}`,
      feedback: summary
    };
  }
}
