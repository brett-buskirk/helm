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

### Advisory warnings are normal

Large or wide-ranging PRs may trip the advisory rules (diff size, lockfile /
dependency changes, `src/**` touched without tests). These are **non-blocking** —
the check still passes; only `secrets` and `dangerous_patterns` block a merge.
Tune `.agentgate.yml` as needed (`scope.allow` lists, `diff_size` limits, or
enabling the intent check).

## CI runs on every PR

A GitHub Actions workflow runs on each PR and must pass: **type-check** (`tsc`),
**circular-import check** (`npm run check:cycles`, madge), **unit tests**
(`npm run test:run`, Vitest), **build** (`npm run build`), and **e2e**
(Playwright, which installs Chromium + deps and runs the smoke suite).

## PR / issue conventions

Every PR and issue is **assigned to Brett**, gets appropriate **labels**, is filed
to a **milestone**, and is added to the **Estate** and **Helm** project boards.

## Repo facts

- **Private** repository, default branch `main`.
- Owner / sole developer: Brett Buskirk (Brett Buskirk LLC).
