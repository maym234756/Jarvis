import { AuditLogger } from "./audit-logger.js";
import { ApprovalQueue } from "./approval-queue.js";
import { PolicyEngine } from "./policy-engine.js";
import { ToolRegistry } from "./tool-registry.js";
import { FileListTool, FileReadTool, FileWriteTool } from "./tools/file-tool.js";
import { ShellAnalyzeTool, ShellRunTool } from "./tools/shell-tool.js";
import { ResearchRunTool, SearchWebTool } from "./tools/search-tool.js";
import { MemoryAddTool, MemoryCompactTool, MemoryIngestTool, MemoryQueryTool, MemoryRebuildTool, MemoryStatsTool } from "./tools/memory-tool.js";
import { ToolSearchTool } from "./tools/tool-search-tool.js";
import { ConnectorAddTool, ConnectorListTool, ConnectorTestTool } from "./tools/connector-tool.js";
import { PreferencesGcTool, PreferencesGetTool, PreferencesSetTool } from "./tools/preference-tool.js";
import { RepoMapTool } from "./tools/repo-tool.js";
import { CapabilityListTool, CapabilitySearchTool, CapabilitySimulateTool } from "./tools/capability-tool.js";
import { EnvironmentInspectTool } from "./tools/environment-tool.js";
import { ContextBudgetTool } from "./tools/context-budget-tool.js";
import { FeedbackRecordTool, FeedbackSummaryTool } from "./tools/feedback-tool.js";
import { ModelMeshRouteTool } from "./tools/model-mesh-tool.js";
import { ControlPlaneDecideTool } from "./tools/control-plane-tool.js";
import { EventListTool, EventSummaryTool } from "./tools/event-tool.js";
import { PolicyShowTool, PolicyStatusTool } from "./tools/policy-tool.js";
import { WorkflowStateListTool } from "./tools/workflow-state-tool.js";
import { ArtifactListTool } from "./tools/artifact-tool.js";

export function createDefaultToolRegistry({ projectRoot, memoryStore, approvalProvider, searchEngine, metricsStore, connectorRegistry, preferenceStore, repoIntelligence, capabilityBus, environmentInspector, contextBudgetManager, feedbackStore, modelMesh, controlPlane, eventBus, policyStore, workflowStateStore, artifactStore } = {}) {
  const approvalQueue = approvalProvider ? null : new ApprovalQueue({ projectRoot });
  const registry = new ToolRegistry({
    projectRoot,
    policyEngine: new PolicyEngine(),
    auditLogger: new AuditLogger({ projectRoot }),
    approvalProvider,
    approvalQueue,
    metricsStore
  });

  registry.register(new FileListTool());
  registry.register(new FileReadTool());
  registry.register(new FileWriteTool());
  registry.register(new ShellAnalyzeTool());
  registry.register(new ShellRunTool());
  registry.register(new SearchWebTool({ searchEngine }));
  registry.register(new ResearchRunTool({ searchEngine }));
  registry.register(new MemoryIngestTool(memoryStore));
  registry.register(new MemoryRebuildTool(memoryStore));
  registry.register(new MemoryCompactTool(memoryStore));
  registry.register(new MemoryStatsTool(memoryStore));
  registry.register(new MemoryQueryTool(memoryStore));
  registry.register(new MemoryAddTool(memoryStore));
  if (connectorRegistry) {
    registry.register(new ConnectorListTool(connectorRegistry));
    registry.register(new ConnectorAddTool(connectorRegistry));
    registry.register(new ConnectorTestTool(connectorRegistry));
  }
  if (preferenceStore) {
    registry.register(new PreferencesGetTool(preferenceStore));
    registry.register(new PreferencesSetTool(preferenceStore));
    registry.register(new PreferencesGcTool(preferenceStore));
  }
  if (repoIntelligence) {
    registry.register(new RepoMapTool(repoIntelligence));
  }
  if (capabilityBus) {
    registry.register(new CapabilityListTool(capabilityBus));
    registry.register(new CapabilitySearchTool(capabilityBus));
    registry.register(new CapabilitySimulateTool(capabilityBus));
  }
  if (environmentInspector) registry.register(new EnvironmentInspectTool(environmentInspector));
  if (contextBudgetManager) registry.register(new ContextBudgetTool(contextBudgetManager));
  if (feedbackStore) {
    registry.register(new FeedbackRecordTool(feedbackStore));
    registry.register(new FeedbackSummaryTool(feedbackStore));
  }
  if (modelMesh) registry.register(new ModelMeshRouteTool(modelMesh));
  if (controlPlane) registry.register(new ControlPlaneDecideTool(controlPlane));
  if (eventBus) {
    registry.register(new EventSummaryTool(eventBus));
    registry.register(new EventListTool(eventBus));
  }
  if (policyStore) {
    registry.register(new PolicyShowTool(policyStore));
    registry.register(new PolicyStatusTool(policyStore));
  }
  if (workflowStateStore) registry.register(new WorkflowStateListTool(workflowStateStore));
  if (artifactStore) registry.register(new ArtifactListTool(artifactStore));
  registry.register(new ToolSearchTool(registry));

  return registry;
}

export { AuditLogger } from "./audit-logger.js";
export { ApprovalQueue } from "./approval-queue.js";
export { PolicyEngine, RISK_LEVELS } from "./policy-engine.js";
export { ToolRegistry } from "./tool-registry.js";
