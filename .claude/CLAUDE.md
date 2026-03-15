---
name: claude-instructions
description: Standing instructions for Claude agents working in this repo
type: project
---

# Claude Agent Instructions — botroom

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
