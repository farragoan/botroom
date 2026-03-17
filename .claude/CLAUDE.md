---
name: claude-instructions
description: Standing instructions for Claude agents working in this repo
type: project
---

# Claude Agent Instructions — botroom

> **Scope:** These instructions apply to **background/autonomous agents** only (e.g. agents invoked via the Claude Agent SDK or CI pipelines). When working interactively with a human in the loop, the human's direct instructions take precedence.

## Pull Request & Merge Protocol

**Always follow this two-step process for code changes:**

1. **Create a PR to `staging` first** — all PRs from feature/fix branches must target `staging`, not `main`.
2. **Wait for CI to pass on `staging`** — do not merge to `main` until build, tests, and secret-scan checks all pass on the `staging` branch.
3. **Merge `staging` → `main`** — only after human review and all checks green on `staging`, open a second PR from `staging` to `main`.

**Never open a PR directly from a feature branch to `main`.**

This ensures every change is verified in a staging environment before it reaches production.

## Branch naming convention
- Feature: `feat/<short-description>`
- Fix: `fix/<short-description>`
- Chore: `chore/<short-description>`
- All branches merge into `staging`, never directly into `main`.

## CI Requirements (must all pass before any merge)
- `npm run build` (TypeScript compile + Vite build)
- `npm test` (Vitest unit tests)
- `npm run typecheck` (strict TypeScript type check)
- Gitleaks secret scan (no leaked API keys, tokens, or credentials)

## Commit hooks
The repo uses `pre-commit` hooks (see `.husky/` or `scripts/hooks/`) that run:
- TypeScript type check
- Unit tests
- Gitleaks secret scan

Do not bypass hooks with `--no-verify`.

## Netlify Deployment — Base Path Routing

Vite is configured with `base: '/botroom/'`, so all asset URLs are prefixed with `/botroom/` at runtime. However, Netlify serves from `dist/` where files live without that prefix (e.g. `/assets/...`, `/registerSW.js`).

The SPA catch-all redirect (`/botroom/*` → `/index.html`) would intercept asset requests and return HTML, causing MIME type errors. To fix this, explicit pass-through redirects must appear **before** the catch-all in `netlify.toml`:

```toml
[[redirects]]
  from   = "/botroom/assets/*"
  to     = "/assets/:splat"
  status = 200

[[redirects]]
  from   = "/botroom/registerSW.js"
  to     = "/registerSW.js"
  status = 200

[[redirects]]
  from   = "/botroom/sw.js"
  to     = "/sw.js"
  status = 200

[[redirects]]
  from   = "/botroom/*"
  to     = "/index.html"
  status = 200
```

If new static file types appear at the `/botroom/` path and break with MIME errors, add a similar pass-through redirect before the catch-all.

## Terminal Mode — Agent Harness

The debate engine can be run directly from the command line without a browser or Netlify dev server. The CLI script imports the orchestrator and agent logic directly from `netlify/functions/lib/` — no HTTP layer.

### Running a debate

```bash
GROQ_API_KEY=gsk_... npx tsx scripts/debate.ts "<topic>" [options]
```

**Options:**
- `--json` — emit JSON lines to stdout (one object per event); use this when parsing output programmatically
- `--maker-model <id>` — model ID for MAKER agent (default: `llama-3.3-70b-versatile`)
- `--checker-model <id>` — model ID for CHECKER agent (default: `llama-3.3-70b-versatile`)
- `--max-turns <n>` — maximum debate turns (default: 8)
- `--verbose` — include each agent's internal `thinking` field in output

**Standard test prompt** (use this as your baseline for prompt quality evaluation):
```bash
GROQ_API_KEY=gsk_... npx tsx scripts/debate.ts "Thanos was right to kill half of all life in the universe"
```

### Output formats

**Human-readable (default):** Coloured turn-by-turn transcript with agent labels, actions, conceded points, and a synthesis at the end.

**JSON lines (`--json`):** One JSON object per line. Each object is either:
- `{"type":"turn","data":{"turnNumber":N,"agent":"MAKER"|"CHECKER","response":{...}}}` — a completed turn
- `{"type":"synthesis","data":{"synthesis":"...","concludedNaturally":bool,"totalTurns":N}}` — final synthesis
- `{"type":"error","data":{"message":"..."}}` — error; process exits with code 1

### Agent iteration loop

Use this loop to evaluate and improve debate quality:

1. **Run** the debate with the standard test prompt
2. **Read** the output — assess:
   - Are agents restating the same points or genuinely escalating?
   - Is CHECKER finding real logical flaws or just objecting generically?
   - Are concessions strategic or reflexive?
   - Does the debate converge toward a shared position, or does it stalemate?
   - Is context growing faster than argument quality improves? (sign of prompt bloat)
3. **Edit** `netlify/functions/lib/agent.ts` — the system prompts are `MAKER_SYSTEM` and `CHECKER_SYSTEM` (lines 3–51). These are the primary levers:
   - How agents are instructed to handle prior context as turns accumulate
   - Whether agents are guided toward genuine position updates vs. fixed adversarial stances
   - The conditions under which CONCLUDE is appropriate
4. **Re-run** with the same topic and compare
5. Repeat until debate quality improves (natural convergence without forced concede, context managed tightly)

### What NOT to change in the iteration loop

- Do not modify `orchestrator.ts` turn logic unless changing the debate topology itself
- Do not modify `types.ts` unless adding new agent capabilities
- The `CONCEDE` action node exists but should become less relied upon as prompts improve — the goal is position updates through argument quality, not structured exit ramps
