# Minimum Security Controls

Jarvis assumes that agent tool access can cause real damage if it is not constrained.

## Controls

- File tools are workspace-scoped.
- Shell commands are classified before execution.
- Tier 2 and Tier 3 actions require approval.
- Tier 4 actions are blocked by default.
- Web search is treated as untrusted input.
- Tool events are logged to `.jarvis/logs/audit.jsonl`.
- API approval requests are persisted to `.jarvis/approvals/queue.json`.
- Sessions and run history are stored locally under `.jarvis/sessions/` and `.jarvis/runs/`.
- Backend dock reports are stored locally under `.jarvis/docking/` and list environment variable names, not secret values.
- Performance metrics are stored locally under `.jarvis/metrics/`.
- Memory stores text chunks and metadata, not secrets.
- Search results and fetched source pages are treated as untrusted data and are only used as evidence.

## Risk Tiers

```text
Tier 0: read-only
Tier 1: local safe write or tests
Tier 2: network, package, external API
Tier 3: system configuration
Tier 4: destructive or credential-risking actions
```

## Known Gaps

- Shell classification is conservative but pattern-based.
- There is no container sandbox yet.
- There is no malware scan or checksum verifier yet for downloads.
- There is no multi-user authentication layer yet.
- The web console is intended for trusted local use and does not include authentication yet.
- Query/source ranking improves precision but does not replace source verification.
