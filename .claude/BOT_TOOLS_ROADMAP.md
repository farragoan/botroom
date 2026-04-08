# Bot Tools & Platform Roadmap

> **Status:** Planning document — no code changes yet.
> **Date:** 2026-04-07
> **Scope:** Tool system design for MAKER/CHECKER agents; clarification UX; backend architecture decision; roadmap gap analysis.

---

## 1. Context: Where We Are

MAKER and CHECKER currently receive only a topic string and their fixed system prompts. They produce structured JSON (thinking, message, action, conceded\_points, conclusion\_summary) through a simple turn-based loop in `netlify/functions/lib/orchestrator.ts`. Neither bot can query external data, ask the user questions, or call any external service mid-debate.

The `literature_review.md` already identified several failure modes (sycophantic convergence, label-only personas, no observer gate). The tools described below address a separate layer: **epistemic grounding** — giving agents the ability to anchor arguments in verifiable facts and to seek scope clarity before committing to a position.

---

## 2. Proposed Tool System

### 2.1 Architecture Model: Tool-Calling Loop

Each agent's `respond()` method (currently a single API call) becomes a **tool-calling loop**:

```
Agent.respond(userMessage)
  │
  ├─ LLM call → if response contains tool_call → execute tool → append result → repeat
  └─ LLM call → no tool_call → return AgentResponse (final)
```

This mirrors the OpenAI/Anthropic tool-use protocol. Groq supports this natively for compatible models. The loop runs inside `agent.ts` before `orchestrator.ts` ever sees the response — orchestrator remains unchanged.

**Type change needed in `types.ts`:**

```typescript
export interface ToolCall {
  tool: 'web_search' | 'ask_user';
  input: Record<string, string>;
}

export interface ToolResult {
  tool: string;
  output: string;
}
```

---

### 2.2 Tool 1: Web Search

**Purpose:** Allow bots to retrieve current, verifiable information to support or rebut claims — preventing debates from becoming pure assertion contests.

**Candidate APIs:**
| Provider | Notes |
|---|---|
| Tavily | Purpose-built for agents; returns AI-optimised summaries; free tier available |
| Brave Search API | Privacy-respecting; raw results with good coverage; cheap |
| Serper (Google wrapper) | Highest result quality; not free at scale |
| Exa | Semantic search; better for research-style queries than keyword search |

**Recommendation:** Start with Tavily (`TAVILY_API_KEY` env var) — its response format is compact and already structured for LLM context injection.

**Prompt-level guidance (in system prompt):**
- Search at most once per turn to avoid context bloat.
- Only search when an empirical claim needs grounding; do not search for rhetorical support.
- Cite the source URL inline in the argument.

**Implementation sketch:**
1. Add `TAVILY_API_KEY` to Netlify env vars and local `.env`.
2. Create `netlify/functions/lib/tools/webSearch.ts` — thin wrapper around Tavily `/search`.
3. In `agent.ts`, after the first LLM call, check for `tool_calls`; if `web_search`, call the wrapper, append result as a `tool` role message, call LLM again.
4. Cap tool loop at 2 iterations per turn.

---

### 2.3 Tool 2: User Clarification Request

**Purpose:** Before arguments begin, a bot may ask the user a single clarifying question if the topic is ambiguous, underspecified, or scope-dependent. This prevents wasted turns arguing past each other.

#### 2.3.1 Gating: Autonomous vs. Interactive Toggle

A user-controlled flag — **"Allow pre-debate clarification"** — controls whether this tool is available.

| Mode | Toggle State | Behaviour |
|---|---|---|
| Fully autonomous | Off (default) | Bots proceed immediately; no pause for user input |
| Interactive | On | Pre-debate clarification phase is activated |

**UI implementation:** A checkbox on the topic submission form (in `src/pages/HomePage.tsx`). The flag is passed through `DebateConfig` to the orchestrator.

**State change in `types.ts`:**

```typescript
export interface DebateConfig {
  topic: string;
  makerModel: string;
  checkerModel: string;
  maxTurns: number;
  verbose: boolean;
  allowClarification: boolean;   // NEW
}
```

#### 2.3.2 Constraint: One Shot, Pre-Argument Only

- Clarification may only be requested **once**, during a dedicated pre-debate phase that runs **before Turn 1**.
- Only **one bot** asks (recommend MAKER, since it opens the debate — CHECKER's stance depends on MAKER's framing).
- If the bot decides clarification is not needed, it emits `clarification_needed: false` and the debate starts immediately.
- The user's clarification response is prepended to the topic context for **both** bots.

**Pre-debate phase flow:**

```
[User submits topic + allowClarification=true]
         │
         ▼
MAKER: "Do I need clarification?" 
  └─ YES → emit clarification_question to UI → wait for user input
  └─ NO  → debate starts normally
         │
         ▼
User responds → response appended to topic context for both bots
         │
         ▼
Turn 1 begins (MAKER opens)
```

**Orchestrator additions (in `orchestrator.ts`):**

```typescript
async function* preClarificationPhase(
  maker: Agent,
  config: DebateConfig,
  userInputCallback: (question: string) => Promise<string>
): AsyncGenerator<DebateEvent> {
  if (!config.allowClarification) return;
  // Ask MAKER if clarification needed; if yes, yield event, await callback, inject into both agents
}
```

The `userInputCallback` is a promise that resolves when the user submits their answer. In the web client, this maps to a prompt UI panel. In CLI mode (`scripts/debate.ts`), it maps to a readline prompt.

#### 2.3.3 CLI Support

In `scripts/debate.ts`, add a `--allow-clarification` flag. When set, the script prompts stdin before starting the debate loop.

---

## 3. Additional Tools Worth Evaluating

Beyond web search and user clarification, the following tools merit consideration as the platform matures:

### 3.1 Calculator / Structured Reasoning

Bots often make quantitative claims (populations, percentages, growth rates) without computing them. A sandboxed `eval`-style calculator tool (input: math expression → output: numeric result) would let bots verify arithmetic before asserting it.

**Risk:** Low. Pure input→output, no external calls.
**Priority:** Medium. Useful for debates involving statistics or policy costs.

### 3.2 Document / URL Attachment

Allow the user to attach a URL or paste a document before the debate starts. Both bots receive a summarised version as part of their initial context. Useful for debates grounded in a specific article, paper, or policy text.

**Implementation:** User pastes URL → backend fetches and strips to plain text (via `@mozilla/readability` or equivalent) → truncated to token budget → injected into both agents' initial system context.

**Priority:** High. Grounds debates in shared source material; prevents "I heard that..." style arguments.

### 3.3 Memory / Scratchpad (Per-Agent)

Currently agents rely solely on the chat history for memory. A lightweight per-agent key-value scratchpad (written and read via tool calls) would allow bots to explicitly track:
- Claims they've committed to
- Points they've conceded
- Evidence they've already cited

This complements (or eventually replaces) the `conceded_points` field in the current JSON protocol.

**Priority:** Low initially. Becomes more relevant at high turn counts (>12) or with N-agent topologies.

### 3.4 Observer / Judge Agent (already in literature_review)

Not strictly a "tool" but architecturally similar: a third agent that observes without arguing, evaluates argument quality, and can veto CONCLUDE/CONCEDE actions. Described in `literature_review.md` as the single highest-priority intervention against sycophantic convergence.

**Priority:** High. Should be built alongside or before the tool system.

---

## 4. Backend Architecture Decision: Netlify Functions vs. Dedicated Backend

### 4.1 Current Setup

All server-side logic runs as Netlify serverless functions (esbuild-bundled `.mts` files). This gives zero-ops deployment but imposes constraints:

| Constraint | Impact |
|---|---|
| 10s synchronous function timeout (26s background) | Debates with many turns or slow models can exceed this |
| No persistent in-memory state between invocations | Each function call is cold; session state must live in client or a DB |
| No WebSocket support natively | Streaming must be done via SSE or polling |
| No long-running background jobs | Can't queue debate turns asynchronously |

Currently the web client streams via SSE (Server-Sent Events) using Netlify's streaming response support — this works but is fragile at scale.

### 4.2 When to Move to a Dedicated Backend

The platform needs a dedicated backend **if any of the following are true:**

1. Debates regularly exceed 26 seconds total (e.g., 12+ turns with web search calls).
2. N-agent support (4+ agents) requires a coordination layer that maintains shared state across agents mid-debate.
3. Session persistence (save/resume debates) is required.
4. The observer/judge agent needs to interject between turns in real time.
5. Tool calls (web search) need to be queued and rate-limited across concurrent user sessions.

**Short-term verdict:** Netlify functions are sufficient for the current 2-agent, 8-turn model. The tool-calling loop adds latency but likely stays within the 26s background limit with Groq's fast inference.

**Medium-term verdict:** Once N-agent support and the observer pattern are in place, a dedicated backend becomes the right call.

### 4.3 Recommended Dedicated Backend Stack (when the time comes)

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Node.js 22 / Bun | TypeScript-native; shares types with frontend and Netlify functions |
| Framework | Hono or Fastify | Lightweight, typed, WebSocket-capable |
| Transport | WebSockets (ws) or SSE | Real-time turn streaming without polling |
| Queue | BullMQ + Redis | Debate sessions as jobs; allows per-session rate limiting and retry |
| Persistence | Supabase (Postgres) | Debate transcripts, user sessions, clarification answers |
| Deployment | Fly.io or Railway | Persistent processes (unlike serverless); cheap at low scale |

**Migration path:** Keep the Netlify function API contract intact. Move the function bodies into the dedicated backend behind the same `/api/debate` route. Frontend changes zero lines.

### 4.4 Note on "Continuously Running" Functions

If the intent is to keep a debate session alive across multiple HTTP round-trips without a dedicated server, an alternative is **Durable Objects** (Cloudflare) or **Vercel Edge Runtime with KV**. These offer persistent, stateful compute without managing a server. Durable Objects in particular map well to the debate session model (one object per active debate). This is worth evaluating if the team wants to stay serverless while gaining persistent state.

---

## 5. Roadmap Gap Analysis

The existing roadmap (from `.claude/PLAN.md` and `literature_review.md`) covers:

| Item | Status |
|---|---|
| 2-agent debate (MAKER + CHECKER) | **Done** |
| Groq + OpenRouter model support | **Done** |
| Web UI (React + Netlify) | **Done** |
| CLI terminal mode | **Done** |
| CI/CD with secret scan | **Done** |
| PWA support | **Done** |
| Anti-sycophancy system prompts | **Done** (ANTI-SYCOPHANCY section in both agent prompts) |
| Observer/judge agent | **Done** (`lib/observer.ts` — rule-based min-turn veto) |
| Minimum turn enforcement | **Done** (`minTurnsBeforeConclusion` config field + Observer) |
| Tool-calling loop scaffold | **Done** (`callLLM()` + tool loop in `agent.ts`) |
| Web search tool (Tavily) | **Done** (`lib/tools/webSearch.ts` + env `TAVILY_API_KEY`) |
| User clarification toggle | **Done** (checkbox in TopicForm; `/api/clarify` endpoint; CLI `--allow-clarification`) |
| Identity-level persona diversity | **Not started** |
| Agent anonymization in inter-agent messages | **Not started** |
| N-agent support (4+) | **Not started** |
| LangGraph / workflow graph integration | **Not started** |
| Document/URL attachment | **Not started** |
| Session save / resume | **Not started** |
| Debate history / replay | **Not started** |
| Dedicated backend (when warranted) | **Not started** |
| Observer LLM-based quality evaluation | **Not started** (current observer is rule-based only) |
| Scratchpad / per-agent memory tool | **Not started** |
| Calculator tool | **Not started** |

### 5.1 Suggested Build Order

The following sequencing minimises risk and maximises compound value:

**Phase 1 — Structural integrity (before any new tools)**
1. Observer/judge agent with CONCLUDE/CONCEDE veto
2. Minimum turn enforcement (6 turns before either CONCLUDE is valid)
3. Anti-conformity language in system prompts (explicit instruction not to capitulate to social pressure)

> Rationale: Tools amplify whatever debate quality already exists. If sycophantic convergence is still a failure mode, adding web search will just make agents find supporting evidence for premature agreement. Fix the structural problem first.

**Phase 2 — Tool system scaffold**
4. Tool-calling loop in `agent.ts` (generic; no specific tools yet)
5. Web search tool (Tavily)
6. User clarification toggle + pre-debate phase

**Phase 3 — Richer context**
7. Document/URL attachment (user-supplied sources)
8. Calculator tool (arithmetic verification)
9. Per-agent scratchpad

**Phase 4 — Scale and topology**
10. Identity-level personas (Optimist, Pessimist, Devil's Advocate, Empiricist)
11. N-agent support (generalise orchestrator from 2 to N)
12. Backend architecture migration (evaluate at phase 3/4 boundary)
13. Session persistence and debate history

**Phase 5 — Polish**
14. Real-time streaming UI improvements
15. Debate replay
16. Export / share debate transcripts

---

## 6. Open Questions for Next Discussion

1. **Model capability for tool-calling:** Groq's `llama-3.3-70b-versatile` supports tool use, but response quality in tool-call mode vs. raw JSON mode needs benchmarking. Do we switch models for tool-calling or prompt-engineer tool use into the existing JSON protocol?

2. **Clarification: MAKER only or both?** Current proposal has only MAKER ask for clarification (since it frames the opening). Should CHECKER also get to ask a clarification question, or does that double the pre-debate latency for minimal gain?

3. **Web search budget:** How many searches per turn? Per debate? Do both bots share a budget or get individual allocations? Tavily free tier is 1,000 searches/month — at 2 searches/turn × 8 turns = 16/debate, that's ~62 debates/month on free tier before costs accrue.

4. **Clarification in CLI mode:** Readline-based stdin prompt is straightforward. Should `--allow-clarification` be on by default in CLI mode (since there's always a human at the terminal) and off by default in web mode?

5. **Durable Objects vs. dedicated backend:** Worth a spike to evaluate Cloudflare Durable Objects before committing to a full backend migration.
