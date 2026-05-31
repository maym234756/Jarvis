export const WORKFLOW_TEMPLATES = {
  chat: {
    name: "GeneralChatWorkflow",
    steps: ["understand", "retrieve-memory", "answer"],
    validation: ["answer addresses the user request"]
  },
  coding: {
    name: "CodeChangeWorkflow",
    steps: ["inspect-repo", "find-relevant-files", "patch", "test", "summarize"],
    validation: ["focused tests pass", "changes are scoped"]
  },
  debug: {
    name: "DebugWorkflow",
    steps: ["capture-failure", "isolate-cause", "patch", "regression-test"],
    validation: ["failure is reproduced or explained", "regression coverage exists"]
  },
  research: {
    name: "ResearchWorkflow",
    steps: ["clarify-target", "search-approved-sources", "cross-check", "cite"],
    validation: ["claims are traceable to sources"]
  },
  ingestion: {
    name: "DataIngestionWorkflow",
    steps: ["extract", "normalize", "chunk", "embed-or-index", "retrieve-test"],
    validation: ["chunks include metadata", "query finds relevant chunks"]
  },
  "os-download": {
    name: "OSDownloadWorkflow",
    steps: ["identify-official-source", "show-size-license-checksum", "ask-approval", "download", "verify"],
    validation: ["official URL", "checksum verified", "no auto-install"]
  },
  security: {
    name: "SecurityReviewWorkflow",
    steps: ["map-capabilities", "check-policy", "inspect-secrets-boundaries", "log-findings"],
    validation: ["risky actions are approval-gated"]
  },
  deployment: {
    name: "DeploymentWorkflow",
    steps: ["build", "configure", "smoke-test", "rollout", "monitor"],
    validation: ["rollback path exists", "health checks pass"]
  }
};
