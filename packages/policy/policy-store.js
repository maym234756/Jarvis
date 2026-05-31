import fs from "node:fs";
import path from "node:path";

export const DEFAULT_POLICY = {
  version: 1,
  network: {
    default: "ask",
    allowDomains: ["docs.github.com", "nodejs.org", "npmjs.com", "github.com"]
  },
  shell: {
    requireApprovalFor: ["install", "download", "delete", "service_change", "admin_command"],
    blockPatterns: ["rm -rf /", "format", "curl | sh", "Invoke-Expression"]
  },
  files: {
    allowWritePaths: ["."],
    blockPaths: [".ssh", ".aws", ".env"]
  },
  secrets: {
    neverSendToModel: true,
    neverStoreInMemory: true
  }
};

export class PolicyStore {
  constructor({ projectRoot = process.cwd() } = {}) {
    this.projectRoot = projectRoot;
    this.stateDir = path.join(this.projectRoot, ".jarvis", "policy");
    this.policyPath = path.join(this.stateDir, "policy.json");
  }

  async getPolicy() {
    try {
      return mergePolicy(DEFAULT_POLICY, JSON.parse(await fs.promises.readFile(this.policyPath, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") return DEFAULT_POLICY;
      throw error;
    }
  }

  async savePolicy(policy) {
    const next = mergePolicy(DEFAULT_POLICY, policy || {});
    await fs.promises.mkdir(this.stateDir, { recursive: true });
    await fs.promises.writeFile(this.policyPath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  async status() {
    const configured = await exists(this.policyPath);
    const policy = await this.getPolicy();
    return {
      configured,
      path: this.policyPath,
      version: policy.version,
      blockedShellPatterns: policy.shell.blockPatterns.length,
      blockedFilePaths: policy.files.blockPaths.length,
      networkDefault: policy.network.default
    };
  }
}

function mergePolicy(base, override) {
  return {
    ...base,
    ...override,
    network: { ...base.network, ...(override.network || {}) },
    shell: { ...base.shell, ...(override.shell || {}) },
    files: { ...base.files, ...(override.files || {}) },
    secrets: { ...base.secrets, ...(override.secrets || {}) }
  };
}

async function exists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
