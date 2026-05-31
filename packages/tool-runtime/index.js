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

export function createDefaultToolRegistry({ projectRoot, memoryStore, approvalProvider, searchEngine, metricsStore, connectorRegistry } = {}) {
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
  registry.register(new ToolSearchTool(registry));

  return registry;
}

export { AuditLogger } from "./audit-logger.js";
export { ApprovalQueue } from "./approval-queue.js";
export { PolicyEngine, RISK_LEVELS } from "./policy-engine.js";
export { ToolRegistry } from "./tool-registry.js";
