import { PolicyEngine } from "../tool-runtime/policy-engine.js";
import { analyzeShellCommand } from "../tool-runtime/tools/shell-tool.js";

export class CapabilityBus {
  constructor({ toolRegistry, policyEngine = new PolicyEngine() } = {}) {
    this.toolRegistry = toolRegistry;
    this.policyEngine = policyEngine;
  }

  setToolRegistry(toolRegistry) {
    this.toolRegistry = toolRegistry;
    return this;
  }

  listCapabilities() {
    return (this.toolRegistry?.listTools?.() || []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      capabilities: tool.capabilities?.length ? tool.capabilities : inferCapabilities(tool.name),
      contract: this.contractFor(tool.name)
    }));
  }

  search(query = "", { limit = 8 } = {}) {
    const matches = this.toolRegistry?.searchTools
      ? this.toolRegistry.searchTools(query, { limit })
      : this.listCapabilities().slice(0, limit);
    return matches.map((tool) => ({
      ...tool,
      capabilities: tool.capabilities?.length ? tool.capabilities : inferCapabilities(tool.name),
      contract: this.contractFor(tool.name)
    }));
  }

  contractFor(toolName) {
    const base = {
      tool: toolName,
      preconditions: ["workspace_available", "policy_check_passed"],
      postconditions: ["audit_event_recorded"],
      rollback: "manual_review",
      audit: ["tool", "risk", "summary", "duration", "result"],
      sandboxable: false,
      simulationSupported: false
    };
    if (toolName === "shell.run") {
      return {
        ...base,
        preconditions: ["workspace_available", "command_classified", "approval_if_network_or_system", "cwd_inside_workspace"],
        postconditions: ["exit_code_recorded", "stdout_stderr_captured", "audit_event_recorded"],
        rollback: "not_available_for_arbitrary_shell_commands",
        sandboxable: true,
        simulationSupported: true
      };
    }
    if (toolName?.startsWith("file.")) {
      return {
        ...base,
        preconditions: ["path_resolves_inside_workspace"],
        postconditions: ["file_operation_result_recorded", "audit_event_recorded"],
        rollback: toolName === "file.write" ? "restore_from_vcs_or_backup" : "not_needed",
        simulationSupported: toolName === "file.write"
      };
    }
    if (toolName?.startsWith("search.") || toolName === "research.run") {
      return {
        ...base,
        preconditions: ["search_provider_configured_or_graceful_fallback", "network_approval_if_required"],
        postconditions: ["sources_ranked", "webpages_treated_as_untrusted_data", "citations_attached"],
        rollback: "not_needed",
        simulationSupported: false
      };
    }
    if (toolName?.startsWith("salesforce.")) {
      return {
        ...base,
        preconditions: ["salesforce_connector_configured", "authenticated_user_permissions_enforced", "approval_if_account_data_access"],
        postconditions: ["salesforce_response_recorded", "secrets_redacted", "audit_event_recorded"],
        rollback: "read_only_queries_do_not_mutate_salesforce",
        sandboxable: false,
        simulationSupported: toolName !== "salesforce.query"
      };
    }
    return base;
  }

  async simulate(toolName, args = {}, context = {}) {
    const tool = this.toolRegistry?.tools?.get(toolName);
    if (!tool) return { ok: false, tool: toolName, error: `Unknown tool: ${toolName}` };
    const riskLevel = await tool.assessRisk(args, context);
    const summary = tool.summarize(args);
    const decision = this.policyEngine.evaluate({ toolName, riskLevel, summary });
    const contract = this.contractFor(toolName);
    const simulation = {
      ok: decision.allowed,
      tool: toolName,
      riskLevel,
      summary,
      decision,
      contract,
      expectedEffects: expectedEffects(toolName, args, riskLevel),
      willExecute: false
    };
    if (toolName === "shell.run") simulation.shell = analyzeShellCommand(args.command || "");
    return simulation;
  }
}

function inferCapabilities(toolName = "") {
  const [domain, action] = toolName.split(".");
  return [domain, action].filter(Boolean);
}

function expectedEffects(toolName, args, riskLevel) {
  if (toolName === "shell.run") {
    const effects = ["runs_shell_command", "captures_stdout_stderr"];
    if (riskLevel >= 2) effects.push("may_access_network_or_external_services");
    if (riskLevel >= 3) effects.push("may_change_system_state");
    if (riskLevel >= 4) effects.push("blocked_as_dangerous");
    return effects;
  }
  if (toolName === "file.write") return [`writes_workspace_file:${args.path || "unknown"}`];
  if (toolName === "memory.ingest") return [`indexes_path:${args.path || "."}`];
  if (toolName === "connector.add") return ["updates_connector_registry"];
  if (toolName?.startsWith("salesforce.")) return ["reads_salesforce_account_data_with_authenticated_user_permissions"];
  return ["read_or_compute_without_direct_side_effects"];
}
