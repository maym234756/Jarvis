import { spawn } from "node:child_process";
import { RISK_LEVELS } from "../policy-engine.js";
import { resolveInsideRoot } from "./path-utils.js";

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bRemove-Item\b[\s\S]*\b-Recurse\b/i,
  /\bRemove-Item\b[\s\S]*\b-Force\b/i,
  /\brmdir\b[\s\S]*\/s\b/i,
  /\brd\b[\s\S]*\/s\b/i,
  /\bdel\b[\s\S]*\/s[\s\S]*\/q/i,
  /\berase\b[\s\S]*\/s\b/i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\breg\s+delete\b/i,
  /\bcipher\s+\/w\b/i
  ,/\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b[\s\S]*-[a-z]*f/i,
  /\bInvoke-Expression\b/i,
  /\biex\b/i,
  /\bEncodedCommand\b/i
];

const SYSTEM_PATTERNS = [
  /\bsetx\s+PATH\b/i,
  /\bSet-ExecutionPolicy\b/i,
  /\bsudo\b/i,
  /\bStart-Process\b[\s\S]*\b-Verb\s+RunAs\b/i,
  /\bSet-ItemProperty\b[\s\S]*HKLM:/i,
  /\bNew-ItemProperty\b[\s\S]*HKLM:/i,
  /\bnetsh\b/i,
  /\bsc\s+(create|delete|config)\b/i,
  /\bNew-Service\b/i,
  /\bchoco\s+install\b/i,
  /\bwinget\s+install\b/i,
  /\bapt(?:-get)?\s+install\b/i,
  /\byum\s+install\b/i,
  /\bbrew\s+install\b/i
];

const NETWORK_PATTERNS = [
  /\bnpm\s+(install|add|update)\b/i,
  /\bnpm\s+ci\b/i,
  /\bnpx\b/i,
  /\bpnpm\s+(install|add|update)\b/i,
  /\byarn\s+(add|install|upgrade)\b/i,
  /\bpip\s+install\b/i,
  /\buv\s+(add|sync|pip\s+install)\b/i,
  /\bcargo\s+install\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bInvoke-WebRequest\b/i,
  /\biwr\b/i,
  /\bgit\s+clone\b/i,
  /\bgit\s+(pull|fetch|submodule\s+update)\b/i,
  /\bdocker\s+pull\b/i
];

const READ_ONLY_PATTERNS = [
  /^\s*(dir|ls|pwd|Get-ChildItem|Get-Location|git\s+status|git\s+diff|node\s+--version|npm\s+--version)\b/i
];

export function classifyShellRisk(command) {
  return analyzeShellCommand(command).riskLevel;
}

export function analyzeShellCommand(command) {
  const reasons = [];
  if (matchAny(DANGEROUS_PATTERNS, command)) {
    reasons.push("Matches a destructive, credential-risking, or command-obfuscation pattern.");
    return { riskLevel: RISK_LEVELS.DANGEROUS, reasons, command };
  }
  if (matchAny(SYSTEM_PATTERNS, command)) {
    reasons.push("Can modify system configuration, services, admin policy, or OS packages.");
    return { riskLevel: RISK_LEVELS.SYSTEM_ACTION, reasons, command };
  }
  if (matchAny(NETWORK_PATTERNS, command)) {
    reasons.push("Can access the network, install packages, or change dependencies.");
    return { riskLevel: RISK_LEVELS.NETWORK_OR_PACKAGE, reasons, command };
  }
  if (matchAny(READ_ONLY_PATTERNS, command)) {
    reasons.push("Recognized as a read-only inspection command.");
    return { riskLevel: RISK_LEVELS.READ_ONLY, reasons, command };
  }
  reasons.push("Unrecognized shell command; treated as local write/test risk.");
  return { riskLevel: RISK_LEVELS.LOCAL_WRITE, reasons, command };
}

function matchAny(patterns, command) {
  return patterns.some((pattern) => pattern.test(command));
}

export class ShellAnalyzeTool {
  constructor() {
    this.name = "shell.analyze";
    this.description = "Explain shell command risk without running it.";
    this.riskLevel = RISK_LEVELS.READ_ONLY;
  }

  async assessRisk() {
    return this.riskLevel;
  }

  summarize(args) {
    return `Analyze ${args.command}`;
  }

  async run(args) {
    if (!args.command) throw new Error("command is required");
    const analysis = analyzeShellCommand(args.command);
    return {
      summary: `Tier ${analysis.riskLevel}: ${analysis.reasons.join(" ")}`,
      analysis
    };
  }
}

export class ShellRunTool {
  constructor() {
    this.name = "shell.run";
    this.description = "Run a workspace-scoped shell command with policy checks.";
    this.riskLevel = RISK_LEVELS.LOCAL_WRITE;
  }

  async assessRisk(args) {
    if (!args.command) throw new Error("command is required");
    if (args.dryRun) return RISK_LEVELS.READ_ONLY;
    return classifyShellRisk(args.command);
  }

  summarize(args) {
    return args.command;
  }

  async run(args, context) {
    if (args.dryRun) {
      const analysis = analyzeShellCommand(args.command);
      return {
        summary: `Dry run only. Tier ${analysis.riskLevel}: ${analysis.reasons.join(" ")}`,
        analysis
      };
    }

    const cwd = resolveInsideRoot(context.projectRoot, args.cwd || ".");
    const timeoutMs = Number(args.timeoutMs || 30000);
    const maxOutput = Number(args.maxOutput || 20000);

    const result = await runCommand(args.command, { cwd, timeoutMs, maxOutput });
    return {
      summary: `Exit ${result.exitCode}; stdout ${result.stdout.length} chars; stderr ${result.stderr.length} chars`,
      ...result
    };
  }
}

function runCommand(command, { cwd, timeoutMs, maxOutput }) {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk.toString("utf8"), maxOutput);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk.toString("utf8"), maxOutput);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${error.message}`.trim(), timedOut });
    });
  });
}

function appendBounded(current, next, maxOutput) {
  const value = current + next;
  if (value.length <= maxOutput) return value;
  return value.slice(value.length - maxOutput);
}
