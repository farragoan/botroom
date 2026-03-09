# botroom — Agent Plan

## Goal
Two AI agents (Maker + Checker) debate a topic via OpenRouter, reach consensus, produce synthesis.

## Status: MVP TUI — v0.1

## Architecture Summary
```
debate.py (CLI entry)
  └── Orchestrator
        ├── Agent("MAKER", maker_model)
        ├── Agent("CHECKER", checker_model)
        └── DebateDisplay (Rich TUI)
```

## Agent Protocol
Each agent responds with JSON:
```json
{
  "thinking": "internal 1-3 sentence reasoning",
  "message": "text to other agent",
  "action": "CONTINUE | CONCLUDE | CONCEDE",
  "conceded_points": ["..."],
  "conclusion_summary": "only on CONCLUDE"
}
```

## Turn Loop
1. MAKER opens with a position on the topic
2. CHECKER critiques/challenges
3. Each turn: MAKER responds → CHECKER responds
4. Termination: both emit CONCLUDE in same turn, OR max_turns reached
5. Synthesis: separate LLM call summarizes consensus + residual gaps

## Termination Rules
- CONCLUDE by agent A → other agent notified, gets 1 response
- If both CONCLUDE → stop, synthesize
- max_turns (default 10) → force stop, synthesize

## Models (free tier, OpenRouter)
- deepseek/deepseek-r1:free
- meta-llama/llama-3.3-70b-instruct:free
- google/gemma-3-27b-it:free
- microsoft/phi-4-reasoning:free

## Roadmap
- [x] v0.1: TUI MVP, two hardcoded free models, JSON protocol
- [ ] v0.2: model selection CLI flags, session save/load
- [ ] v0.3: web GUI (React + FastAPI), real-time streaming
- [ ] v0.4: N agents, branching topologies
