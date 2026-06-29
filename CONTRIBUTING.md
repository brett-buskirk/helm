# Contributing & Repo Conventions

This repo was provisioned with the same guardrails as the rest of the
`brett-buskirk` estate. Read this before pushing code.

## Branch & PR workflow (required)

- **No direct commits to `main`.** `main` is protected by a branch ruleset that
  requires changes to arrive via pull request.
- Work on a feature branch, then open a PR with the `gh` CLI:
  ```bash
  git checkout -b <type>/<short-name>     # e.g. feat/phase-0-scaffold
  # ...commit work...
  git push -u origin <branch>
  gh pr create --fill
  ```
- The repo admin (Brett) can bypass in a pinch, but PR-first is the default.

## AgentGate runs on every PR

This repo uses [AgentGate](https://github.com/brett-buskirk/agent-gate) — CI
guardrails for AI-agent PRs. On each PR it inspects the diff and posts a verdict.
Config lives in `.agentgate.yml`. Current policy:

| Rule | Severity | Catches |
|------|----------|---------|
| `secrets` | **error — blocks merge** | leaked credentials |
| `dangerous_patterns` | **error — blocks merge** | `eval(`, `--no-verify`, `child_process.exec(` |
| `scope` | warning | out-of-scope / CI / lockfile edits (advisory for now) |
| `diff_size` | warning | > 30 files or > 800 lines |
| `tests_required` | warning | `src/**` changed without tests |
| `dependencies` | warning | manifest changes (supply-chain) |
| `intent` (LLM) | off | enable later with an `ANTHROPIC_API_KEY` secret |

Only `secrets` and `dangerous_patterns` block a merge; everything else is advisory.

### Expect warnings on the Phase 0 scaffold

The first scaffold PR (React / Vite / Dexie / PWA) will trip several **warnings** —
large diff, new `package.json` + lockfile, source without tests yet. These are
non-blocking and expected; the check still passes. Tune `.agentgate.yml` as the
codebase matures — e.g. add a `scope.allow` list once `src/` exists, raise the
`diff_size` limits for big scaffolds, or enable the intent check.

## Repo facts

- **Private** repository, default branch `main`.
- Owner / sole developer: Brett Buskirk (Brett Buskirk LLC).
