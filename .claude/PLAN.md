# botroom — Product Plan

## What It Is
Two AI agents (MAKER + CHECKER) debate any topic using Groq/OpenRouter models. Users pick a topic and models, watch the debate unfold in real-time, get a synthesis at the end.

## Current Status: Web MVP live on Netlify
- React + Vite frontend, Netlify Functions backend
- Debate engine: Groq/OpenRouter (existing `netlify/functions/debate.mts`)
- No auth, no persistence, no billing yet

## Build Sequence (all built before first public launch)

### Phase 1 — Auth (Clerk)
Gate debates behind login. On first sign-in, create user row in Turso.

### Phase 2 — Storage (Turso/libSQL)
Persist debates: save turns + synthesis, show history, allow replay.

### Phase 3 — Billing (Razorpay)
Prepaid wallet: users top up INR → wallet drained per debate turn → negative balance blocks further use.

**Note:** All three phases built together, launched together.

---

## Architecture

```
Frontend (Vite/React)
  ├── Clerk <SignIn> / <UserButton>
  ├── /          — home / topic form (auth-gated)
  ├── /debate/:id — debate arena (live + replay)
  ├── /history   — past debates list
  └── /billing   — wallet balance + Razorpay top-up

Netlify Functions
  ├── debate.mts            — orchestration (existing, add auth + metering)
  ├── me.mts                — GET /api/me → user row + wallet balance
  ├── debates.mts           — GET /api/debates → list user's past debates
  ├── debate-detail.mts     — GET /api/debates/:id → full turns + synthesis
  ├── create-order.mts      — POST /api/create-order → Razorpay order
  └── razorpay-webhook.mts  — POST /api/razorpay-webhook → HMAC verify + top up

Turso (libSQL)
  └── users, debates, turns, usage_events, payments

Clerk
  └── Auth + JWT verification in every authenticated function
```

---

## Database Schema

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Clerk userId
  email TEXT NOT NULL,
  razorpay_customer_id TEXT,
  wallet_balance_paise INTEGER DEFAULT 50000,  -- ₹500 free credit on signup
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE debates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  maker_model TEXT NOT NULL,
  checker_model TEXT NOT NULL,
  status TEXT DEFAULT 'running',    -- running | completed | failed
  total_tokens INTEGER DEFAULT 0,
  total_cost_paise INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE turns (
  id TEXT PRIMARY KEY,
  debate_id TEXT NOT NULL REFERENCES debates(id),
  turn_number INTEGER NOT NULL,
  agent TEXT NOT NULL CHECK(agent IN ('MAKER', 'CHECKER')),
  content TEXT NOT NULL,            -- full JSON agent response
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_paise INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  debate_id TEXT REFERENCES debates(id),
  turn_id TEXT REFERENCES turns(id),
  tokens_used INTEGER NOT NULL,
  cost_paise INTEGER NOT NULL,
  balance_after_paise INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT,
  amount_paise INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',    -- pending | success | failed
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Billing Model — Prepaid Wallet

**Storage unit:** `wallet_balance_paise` (integer paise, 100 paise = ₹1)

**Pricing:** 2× markup on OpenRouter's per-model cost, converted to paise at USD/INR 85.

**Per-model rate table (server-side only, in `netlify/functions/lib/pricing.ts`):**
```ts
// paise per 1k tokens (input and output averaged, at 2x markup)
export const MODEL_RATES: Record<string, { input: number; output: number }> = {
  // Groq
  'llama-3.3-70b-versatile':   { input: 6,  output: 8  },  // ~$0.06/$0.08 per 100k → ×2 → paise/1k
  'llama-3.1-8b-instant':      { input: 1,  output: 1  },
  'mixtral-8x7b-32768':        { input: 4,  output: 4  },
  // OpenRouter
  'openai/gpt-4o':             { input: 430, output: 1290 },
  'anthropic/claude-3.5-sonnet': { input: 260, output: 1020 },
  'google/gemini-flash-1.5':   { input: 14,  output: 42  },
  // fallback for any unlisted model
  'default':                   { input: 50, output: 100 },
};
```

**Deduction per turn:**
```
cost_paise = (prompt_tokens / 1000 × rate.input) + (completion_tokens / 1000 × rate.output)
```
Deducted atomically after each turn via SQL:
```sql
UPDATE users SET wallet_balance_paise = wallet_balance_paise - ? WHERE id = ?
```

**Overdraft policy:**
- Allow balance to go negative (we eat the cost of the final turn that crosses zero)
- If `wallet_balance_paise < -5000` (−₹50 overdraft limit): block new debates
- Show clear "recharge required" UI at negative balance

**Free credit on signup:** ₹500 (50,000 paise) — enough for ~5-10 debates on cheap models

**Top-up packs (INR via Razorpay):**
```ts
export const TOP_UP_PACKS = {
  small:    { amount_paise:  4900, label: '₹49'  },   // ~50 Llama debates
  standard: { amount_paise: 14900, label: '₹149' },   // ~150 Llama debates
  power:    { amount_paise: 39900, label: '₹399' },   // ~400 Llama debates
};
```
(No "tokens granted" field — wallet just gets topped up by the INR amount paid.)

---

## Wallet Top-Up Flow

1. User clicks "Add ₹149" on /billing
2. Frontend → `POST /api/create-order` with `{ pack: 'standard' }`
3. Netlify Function creates Razorpay Order, inserts `payments` row (`status: pending`), returns `{ order_id, amount, currency }`
4. Frontend opens Razorpay checkout modal
5. On payment success: Razorpay fires `payment.captured` webhook
6. Webhook handler: verify HMAC, look up payment row by order_id, update `status: success`, add `amount_paise` to `users.wallet_balance_paise`
7. Frontend polls `/api/me` or listens via optimistic update to reflect new balance

---

## Security Rules
- Turso token never in frontend
- Groq/OpenRouter keys never in frontend
- Razorpay webhook verified via HMAC (raw body, `x-razorpay-signature` header)
- Clerk JWT verified on every authenticated function call
- Wallet top-up ONLY via verified Razorpay webhook — never via frontend callback
- Rate table lives server-side only — clients never compute or report costs

---

## Environment Variables

```
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Turso
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Groq / OpenRouter (already in .env)
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# Razorpay
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
VITE_RAZORPAY_KEY_ID=rzp_...   # public, safe to expose
```

---

## Netlify Function Patterns

### Clerk auth verification
```ts
import { createClerkClient } from '@clerk/backend';
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export default async (req: Request) => {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return new Response('Unauthorized', { status: 401 });
  const { sub: userId } = await clerk.verifyToken(token);
  // ... rest of handler
};
```

### Turso client (singleton per function)
```ts
import { createClient } from '@libsql/client';
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
```

### Razorpay HMAC verification
```ts
import crypto from 'crypto';
const sig = req.headers.get('x-razorpay-signature');
const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
  .update(rawBody).digest('hex');
if (sig !== expected) return new Response('Invalid signature', { status: 400 });
```

---

## Open Questions (resolved)
- [x] Minimum balance to start: none (allow negative up to -₹50)
- [x] Balance runs out mid-debate: eat cost, mark negative, block further use
- [x] Markup: clean 2× on OpenRouter rates
- [x] Cost estimates: not shown to user
- [x] Billing model: prepaid wallet in paise, topped up via Razorpay

---

## Original Debate Engine Reference

### Agent Protocol
```json
{
  "thinking": "internal 1-3 sentence reasoning",
  "message": "text to other agent",
  "action": "CONTINUE | CONCLUDE | CONCEDE",
  "conceded_points": ["..."],
  "conclusion_summary": "only on CONCLUDE"
}
```

### Turn Loop
1. MAKER opens with position
2. CHECKER critiques
3. Alternating turns until both CONCLUDE or max_turns reached
4. Synthesis: separate LLM call summarizes consensus + residual gaps

### Running locally
```bash
GROQ_API_KEY=gsk_... npx tsx scripts/debate.ts "topic here" [--json] [--max-turns N]
```
