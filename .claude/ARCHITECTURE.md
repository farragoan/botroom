# botroom — Architecture

## File Map
```
botroom/
├── .claude/
│   ├── PLAN.md          ← this plan
│   └── ARCHITECTURE.md  ← this file
├── src/
│   ├── __init__.py
│   ├── models.py        ← dataclasses: AgentResponse, DebateResult
│   ├── agent.py         ← Agent class (context mgmt + OpenRouter calls)
│   ├── orchestrator.py  ← turn loop, termination, synthesis
│   └── display.py       ← Rich TUI renderer
├── debate.py            ← CLI entry point
├── config.py            ← models, constants, API base URL
├── requirements.txt
└── .env.example
```

## Key Design Decisions

### Why pure Python (no n8n/orchestrator)?
- Agents talk one-at-a-time (synchronous turn model)
- No event-driven complexity needed at v0.1
- httpx handles OpenRouter REST calls cleanly
- Rich gives a good enough TUI without a web server

### Agent Context Model
Each Agent maintains its OWN message history:
- system prompt (role + protocol)
- alternating user/assistant turns
The "user" messages in each agent's context ARE the other agent's output.
Agents never share a history — they have independent contexts.

### JSON Protocol Rationale
Structured JSON lets the orchestrator:
- Parse action signals (CONCLUDE, CONCEDE, etc.)
- Extract the actual message vs. internal thinking
- Track conceded points for synthesis
Fallback: if JSON parse fails, treat entire response as CONTINUE message.

### Synthesis
After termination, a third LLM call (using MAKER's model) receives:
- full debate transcript (message fields only)
- instruction to produce: consensus points, residual disagreements, recommended conclusion

## Extending
- Add QUERY action: agent asks a question, other must answer before acting
- Add SPLIT action: divide the topic into sub-questions
- Add web GUI: stream tokens via SSE, React frontend
- Add N-agent mode: round-robin or graph topology
