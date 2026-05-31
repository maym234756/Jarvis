# Jarvis AI Platform MVP

Jarvis is a local-first AI operating layer scaffolded from the attached blueprint. It starts with a practical milestone: terminal chat, a small agent loop, model routing, permission-gated tools, chunking memory, workflows, web search hooks, and auditable execution.

This MVP uses only Node.js built-ins, so no package install is required.

## Quick Start

```powershell
npm run chat
```

This starts a fresh local API/web backend first, then opens the terminal chat. The launcher picks `JARVIS_PORT` or the next available port and prints the backend URL.

Start the Python chat UX:

```powershell
npm run chat:python
```

This also starts a fresh backend first. Python 3.11+ must be installed and available as `python`, `python3`, or `py`.

Open only the web console/API:

```powershell
npm run console
```

Inspect backend docks:

```powershell
npm run docks
npm run docks -- test memory.local-jsonl
```

Rebuild the memory index:

```powershell
npm run memory:rebuild -- docs
```

Then visit:

```text
http://localhost:8787
```

If `npm run chat` chooses a different port because `8787` is busy, use the URL printed in the terminal.

Useful terminal commands:

```text
/help
/tools
/ingest docs
/memory architecture
/memory-stats
/compact-memory
/doctor
/docks
/dock test memory.local-jsonl
/engine
/metrics
/evals
/profile deep
/repo
/preferences
/preference set answer.length: concise
/capabilities
/simulate npm install left-pad
/environment
/feedback
/model-mesh coding
/control fix failing tests
/events
/policy
/policy-decide download https://example.com/file.zip
/risk npm install left-pad
/failure timed out while running tests
/ledger
/replay <run-id>
/workflow-state
/artifacts
/connectors
/connector add local.mcp http://localhost:3333
/session new project work
/runs
read README.md
list .
dry run npm ci
analyze command git reset --hard HEAD
run npm test
research current Node.js LTS
search current Node.js LTS
salesforce status
salesforce describe Account
salesforce query SELECT Id, Name FROM Account LIMIT 5
```

Jarvis is local-first. Its core model runs through the local Ollama runtime with `OLLAMA_BASE_URL` and `OLLAMA_MODEL`; hosted model connectors are optional and disabled unless `JARVIS_ALLOW_HOSTED_PROVIDERS=true` and `JARVIS_MODEL_PROVIDER=openai`. Search uses the keyless DuckDuckGo fallback when `DUCKDUCKGO_SEARCH_FALLBACK=true`, with Brave/Tavily kept as optional connectors. Current real-world questions use live read-only research automatically when `JARVIS_AUTO_WEB_RESEARCH=true`.

## API Server

```powershell
npm run api
```

Endpoints:

```text
GET  /health
GET  /providers
GET  /tools
GET  /doctor
GET  /docking
POST /docking/:id/test
GET  /engine
GET  /metrics
GET  /evals
GET  /runtime-profiles
GET  /capabilities
POST /capabilities/search { "query": "run tests" }
POST /capabilities/simulate { "tool": "shell.run", "args": { "command": "npm install left-pad" } }
GET  /environment
POST /context-budget { "taskType": "coding", "runtimeProfile": "deep" }
GET  /feedback
POST /feedback { "taskType": "coding", "ok": true, "note": "worked" }
POST /model-mesh/route { "taskType": "coding", "runtimeProfile": "balanced" }
POST /control-plane/decide { "message": "fix failing tests", "runtimeProfile": "deep" }
GET  /events
GET  /events/stream
GET  /policy
POST /policy { "network": { "default": "ask" } }
POST /policy/decide { "action": "download https://example.com/file.zip" }
POST /risk/score { "command": "npm install left-pad" }
POST /failures/classify { "error": "Timed out while running tests" }
GET  /run-ledger
GET  /run-ledger/:id
GET  /run-ledger/:id/replay
GET  /workflow-state
GET  /artifacts
POST /artifacts { "type": "markdown", "title": "Note", "content": "# Note" }
GET  /preferences
POST /preferences { "key": "answer.length", "value": "concise" }
POST /preferences/gc
GET  /repo
GET  /connectors
POST /connectors { "id": "local.mcp", "url": "http://localhost:3333" }
POST /connectors/:id/test
POST /chat    { "message": "read README.md", "runtimeProfile": "deep" }
POST /ingest  { "path": "docs" }
GET  /approvals
POST /approvals/:id { "approved": true }
GET  /sessions
POST /sessions { "title": "My session" }
GET  /sessions/:id
GET  /runs
POST /memory/query  { "query": "policy", "filters": { "extension": ".md" } }
GET  /memory/stats
POST /memory/compact
POST /memory/rebuild { "path": "docs" }
```

## What Is Built

- Terminal chat UX with modes, command history, tool status, and approval prompts.
- Agent orchestrator with planning, workflow selection, memory retrieval, and tool execution.
- Agent orchestrator with runtime profiles, response-mode selection, verification reports, planning, workflow selection, memory retrieval, and tool execution.
- Local-first model router for Jarvis local inference, optional hosted connectors, offline local draft fallback, and profile-aware routing signals.
- File tools, shell tool, web search tool, and memory ingestion/query tools.
- API approval queue for risky actions requested outside the terminal.
- Web console for chat, approvals, memory search, and tool inventory.
- Python Tkinter chat UX with backend ops shortcuts.
- Doctor diagnostics, saved sessions, and run history.
- Backend Docking Station for model, search, memory, tool, session, run, approval, API, and console docks.
- Connector registry for MCP-style backend docks, endpoint health checks, tool filters, and permission policy metadata.
- Account-aware connector foundation, including a Salesforce read-only connector that uses the authenticated user's object permissions, field-level security, and sharing rules.
- Reasoning engine with task traits, evidence needs, risk notes, answer contracts, and logic graphs.
- Verification engine with plan, tool-result, citation, prompt-injection, and coding verification checks.
- Runtime profiles for Fast, Balanced, and Deep behavior with latency, cost, tool-call, and verification budgets.
- Capability bus with tool contracts, capability search, policy previews, and shell-command simulation before execution.
- AI control plane that previews classification, workflow, model route, tool scope, policy, and context budget for a request.
- Event bus for observable backend events across user messages, tools, approvals, and workflow completion.
- Policy-as-code store with default network, shell, file, and secret-safety rules.
- Policy decision point for allow, deny, approval-required, and sandbox-only preflight decisions.
- Risk scorer for action and plan risk across network, dependency, filesystem, shell, credential, production-impact, and reversibility signals.
- Replayable run ledger with input, decisions, memory reads, tool traces, approvals, artifacts, failures, and final responses.
- Failure taxonomy for recovery playbooks.
- Workflow state store for agent run state transitions and future pause/resume support.
- Artifact store for generated reports, logs, and task outputs with metadata.
- Context budget manager for token allocation, context-pressure detection, and compression recommendations.
- Environment inspector for OS, shell, package manager, git status, and resource awareness.
- Model mesh role router for planner/code/critic/security/composer role selection.
- Feedback learning loop for outcome tracking and future routing signals.
- User preference store with confidence, sensitivity, expiration, and garbage collection.
- Repository intelligence layer with file maps, symbol indexes, package scripts, language summary, and test hints.
- Search engine with query planning, result dedupe, source ranking, source fetching, snippets, citations, cache, and prompt-injection scanning.
- Keyless DuckDuckGo fallback search with HTML result fallback, source fetching, freshness routing, and Brave/Tavily available only as optional keyed connectors.
- Structured answer formatter for clearer tool results, caveats, evidence, and next steps.
- Context compaction for long saved sessions so older turns become a compact summary while recent turns stay intact.
- Tool search for routing requests to the most relevant tools without flooding model prompts.
- Backend eval runner for context, tool routing, search safety, and shell-policy regression checks.
- Metrics store for backend timing, tool durations, cache visibility, and performance summaries.
- Policy engine with risk tiers, approval gates, dangerous action blocking, and audit logs.
- Chunking pipeline with metadata, line citations, hashing, local embeddings, filters, compaction, rebuilds, and persistent JSONL memory.
- Workflow templates for code changes, research, debugging, ingestion, OS downloads, security review, and deployment.
- Built-in test suite using `node --test`.

## Safety Defaults

Jarvis treats tools as capabilities that need policy checks.

```text
Tier 0: read-only actions
Tier 1: local safe writes and tests
Tier 2: network/package actions, approval required
Tier 3: system actions, approval required
Tier 4: dangerous actions, blocked by default
```

Audit events are stored in `.jarvis/logs/audit.jsonl`.

Pending API approvals are stored in `.jarvis/approvals/queue.json`.

Saved sessions live in `.jarvis/sessions/`, and agent runs are tracked in `.jarvis/runs/runs.jsonl`.

The latest Backend Docking Station report is stored at `.jarvis/docking/last-report.json`.

Connector metadata lives in `.jarvis/connectors/connectors.json`. User preferences live in `.jarvis/preferences/user.json`. Feedback events live in `.jarvis/feedback/events.jsonl`. Events live in `.jarvis/events/events.jsonl`, workflow state in `.jarvis/workflow-state/`, artifacts in `.jarvis/artifacts/`, and policy in `.jarvis/policy/policy.json`. Backend evals can be run with `npm run evals`.
