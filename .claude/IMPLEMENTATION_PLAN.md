# Auth + Storage + Billing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk auth, Turso debate persistence, and Razorpay prepaid wallet billing to the existing botroom debate app.

**Architecture:** Three sequential phases — auth gates the app, storage persists debates per user, billing meters token usage and charges via a prepaid INR wallet. All are built together before launch. The existing SSE debate stream is preserved; we layer auth + metering on top of it.

**Tech Stack:** Clerk (auth), `@libsql/client` (Turso/libSQL DB), Razorpay (payments), `@clerk/react` + `@clerk/backend`, `uuid` (row IDs)

**Design doc:** `.claude/PLAN.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `netlify/functions/lib/db.ts` | Turso client singleton |
| `netlify/functions/lib/auth.ts` | Clerk JWT verification helper |
| `netlify/functions/lib/pricing.ts` | Per-model rate table + cost calculation |
| `scripts/migrate.ts` | Run DB schema migration against Turso |
| `netlify/functions/me.mts` | `GET /api/me` — user row + wallet balance |
| `netlify/functions/debates.mts` | `GET /api/debates` — list user's past debates |
| `netlify/functions/debate-detail.mts` | `GET /api/debates/:id` — full turns + synthesis |
| `netlify/functions/create-order.mts` | `POST /api/create-order` — create Razorpay order |
| `netlify/functions/razorpay-webhook.mts` | `POST /api/razorpay-webhook` — HMAC verify + top up wallet |
| `src/lib/auth.ts` | Get Clerk JWT token for API calls |
| `src/features/billing/` | Billing page components |
| `src/features/history/` | History page components |
| `src/pages/HistoryPage.tsx` | Route page for debate history |
| `src/pages/BillingPage.tsx` | Route page for wallet + top-up |

### Modified files
| File | Change |
|---|---|
| `netlify/functions/lib/types.ts` | Add `tokenUsage` field to `Turn` |
| `netlify/functions/lib/orchestrator.ts` | Capture + yield token usage per turn |
| `netlify/functions/debate.mts` | Add auth, user upsert, per-turn balance deduction |
| `src/lib/api.ts` | Send `Authorization` header in `streamDebate` |
| `src/main.tsx` | Wrap app in `<ClerkProvider>` |
| `src/app/router.tsx` | Add history + billing routes, auth guard |
| `src/components/layout/Header.tsx` | Add `<UserButton>` + wallet balance display |
| `package.json` | Add new dependencies |
| `netlify.toml` | Add webhook raw-body passthrough config |

---

## Phase 1 — Dependencies & Infrastructure

### Task 1: Install packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install all new dependencies**

```bash
npm install @clerk/react @clerk/backend @libsql/client uuid razorpay
npm install --save-dev @types/uuid
```

- [ ] **Step 2: Verify install**

```bash
npm run typecheck
```
Expected: no new errors (packages have their own types except uuid)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install clerk, libsql, razorpay, uuid"
```

---

### Task 2: Turso DB client + schema migration script

**Files:**
- Create: `netlify/functions/lib/db.ts`
- Create: `scripts/migrate.ts`

- [ ] **Step 1: Write `db.ts`**

```typescript
// netlify/functions/lib/db.ts
import { createClient } from '@libsql/client';

let _db: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error('TURSO_DATABASE_URL is not set');
    _db = createClient({ url, authToken });
  }
  return _db;
}
```

- [ ] **Step 2: Write `scripts/migrate.ts`**

```typescript
// scripts/migrate.ts
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  razorpay_customer_id TEXT,
  wallet_balance_paise INTEGER DEFAULT 50000,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  maker_model TEXT NOT NULL,
  checker_model TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  total_tokens INTEGER DEFAULT 0,
  total_cost_paise INTEGER DEFAULT 0,
  synthesis TEXT,
  concluded_naturally INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  debate_id TEXT NOT NULL REFERENCES debates(id),
  turn_number INTEGER NOT NULL,
  agent TEXT NOT NULL CHECK(agent IN ('MAKER', 'CHECKER')),
  content TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  cost_paise INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  debate_id TEXT REFERENCES debates(id),
  turn_id TEXT REFERENCES turns(id),
  tokens_used INTEGER NOT NULL,
  cost_paise INTEGER NOT NULL,
  balance_after_paise INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  amount_paise INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);
`;

async function migrate() {
  const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  for (const sql of statements) {
    await db.execute(sql);
    console.log('✓', sql.slice(0, 60));
  }
  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Add migrate script to package.json**

In `package.json` scripts section, add:
```json
"migrate": "dotenv -e .env -- npx tsx scripts/migrate.ts"
```

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/lib/db.ts scripts/migrate.ts package.json
git commit -m "feat: add turso db client and schema migration script"
```

---

### Task 3: Pricing library (pure, fully testable)

**Files:**
- Create: `netlify/functions/lib/pricing.ts`
- Create: `netlify/functions/lib/__tests__/pricing.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// netlify/functions/lib/__tests__/pricing.test.ts
import { describe, it, expect } from 'vitest';
import { calculateCostPaise, MODEL_RATES, OVERDRAFT_LIMIT_PAISE } from '../pricing.js';

describe('calculateCostPaise', () => {
  it('calculates cost for a known model', () => {
    // llama-3.3-70b-versatile: input=6, output=8 paise/1k tokens
    const cost = calculateCostPaise('llama-3.3-70b-versatile', 1000, 1000);
    expect(cost).toBe(14); // (6 + 8) paise
  });

  it('uses default rate for unknown model', () => {
    const cost = calculateCostPaise('some-unknown-model', 1000, 1000);
    const defaultRate = MODEL_RATES['default'];
    expect(cost).toBe(defaultRate.input + defaultRate.output);
  });

  it('rounds up to nearest paise (minimum 1)', () => {
    const cost = calculateCostPaise('llama-3.3-70b-versatile', 1, 1);
    expect(cost).toBeGreaterThanOrEqual(1);
  });

  it('handles zero tokens', () => {
    expect(calculateCostPaise('llama-3.3-70b-versatile', 0, 0)).toBe(0);
  });
});

describe('OVERDRAFT_LIMIT_PAISE', () => {
  it('is -5000 (negative ₹50)', () => {
    expect(OVERDRAFT_LIMIT_PAISE).toBe(-5000);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose netlify/functions/lib/__tests__/pricing.test.ts
```
Expected: FAIL — `Cannot find module '../pricing.js'`

- [ ] **Step 3: Implement `pricing.ts`**

```typescript
// netlify/functions/lib/pricing.ts

// Paise per 1k tokens (input / output), at 2× OpenRouter markup, USD→INR @85
export const MODEL_RATES: Record<string, { input: number; output: number }> = {
  // Groq
  'llama-3.3-70b-versatile':         { input: 6,    output: 8    },
  'llama-3.1-8b-instant':            { input: 1,    output: 1    },
  'mixtral-8x7b-32768':              { input: 4,    output: 4    },
  'gemma2-9b-it':                    { input: 2,    output: 2    },
  // OpenRouter — free models
  'meta-llama/llama-3.3-70b-instruct:free':  { input: 0, output: 0 },
  'google/gemma-3-27b-it:free':             { input: 0, output: 0 },
  // OpenRouter — paid models
  'openai/gpt-4o':                         { input: 430, output: 1290 },
  'openai/gpt-4o-mini':                    { input: 13,  output: 52   },
  'anthropic/claude-3.5-sonnet':           { input: 260, output: 1020 },
  'anthropic/claude-3-haiku':              { input: 21,  output: 107  },
  'google/gemini-flash-1.5':               { input: 14,  output: 42   },
  'mistralai/mistral-large':               { input: 170, output: 510  },
  // Fallback
  'default':                               { input: 50,  output: 100  },
};

export const OVERDRAFT_LIMIT_PAISE = -5000; // −₹50

export function calculateCostPaise(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = MODEL_RATES[modelId] ?? MODEL_RATES['default'];
  const cost = (promptTokens / 1000) * rate.input + (completionTokens / 1000) * rate.output;
  return cost === 0 ? 0 : Math.max(1, Math.ceil(cost));
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- --reporter=verbose netlify/functions/lib/__tests__/pricing.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/pricing.ts netlify/functions/lib/__tests__/pricing.test.ts
git commit -m "feat: add per-model pricing library with 2x markup"
```

---

### Task 4: Clerk auth helper

**Files:**
- Create: `netlify/functions/lib/auth.ts`

- [ ] **Step 1: Write `auth.ts`**

```typescript
// netlify/functions/lib/auth.ts
import { createClerkClient } from '@clerk/backend';

let _clerk: ReturnType<typeof createClerkClient> | null = null;

function getClerk() {
  if (!_clerk) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
    _clerk = createClerkClient({ secretKey });
  }
  return _clerk;
}

/** Extract and verify Clerk JWT from Authorization header. Returns userId. */
export async function requireAuth(req: Request): Promise<string> {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Missing Authorization header');
  }
  const token = header.slice(7);
  try {
    const payload = await getClerk().verifyToken(token);
    return payload.sub;
  } catch {
    throw new AuthError('Invalid or expired token');
  }
}

export class AuthError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/lib/auth.ts
git commit -m "feat: add clerk auth helper for netlify functions"
```

---

## Phase 2 — Auth Layer

### Task 5: Wrap frontend in ClerkProvider

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/app/router.tsx`
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Update `src/main.tsx`**

Replace the entire file:
```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from '@/app/App';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Create `src/lib/auth.ts` — helper to get token for API calls**

```typescript
// src/lib/auth.ts
import { useAuth } from '@clerk/react';

/** Call inside async functions to get the Bearer token for Netlify Function calls */
export async function getAuthHeader(
  getToken: ReturnType<typeof useAuth>['getToken']
): Promise<{ Authorization: string }> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}
```

- [ ] **Step 3: Add auth-guard to router — wrap existing routes**

Replace `src/app/router.tsx`:
```tsx
// src/app/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import Layout from '@/components/layout/Layout';
import AuthGuard from '@/components/layout/AuthGuard';
import HomePage from '@/pages/HomePage';
import DebatePage from '@/pages/DebatePage';
import HistoryPage from '@/pages/HistoryPage';
import BillingPage from '@/pages/BillingPage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/sign-in', element: <SignIn routing="path" path="/sign-in" /> },
        {
          element: <AuthGuard />,
          children: [
            { path: '/', element: <HomePage /> },
            { path: '/debate', element: <DebatePage /> },
            { path: '/history', element: <HistoryPage /> },
            { path: '/billing', element: <BillingPage /> },
          ],
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: '/' }
);
```

- [ ] **Step 4: Create `src/components/layout/AuthGuard.tsx`**

```tsx
// src/components/layout/AuthGuard.tsx
import { useAuth } from '@clerk/react';
import { Navigate, Outlet } from 'react-router-dom';

export default function AuthGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null; // brief loading flash
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}
```

- [ ] **Step 5: Create stub pages so router compiles**

```tsx
// src/pages/HistoryPage.tsx
export default function HistoryPage() {
  return <div className="p-8 text-white">History — coming soon</div>;
}
```

```tsx
// src/pages/BillingPage.tsx
export default function BillingPage() {
  return <div className="p-8 text-white">Billing — coming soon</div>;
}
```

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
npm run typecheck && npm run build
```
Expected: clean build

- [ ] **Step 7: Commit**

```bash
git add src/main.tsx src/app/router.tsx src/lib/auth.ts \
  src/components/layout/AuthGuard.tsx \
  src/pages/HistoryPage.tsx src/pages/BillingPage.tsx
git commit -m "feat: add clerk auth provider, route guard, sign-in page"
```

---

### Task 6: Update Header with UserButton + wallet balance

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Read current Header**

Read `src/components/layout/Header.tsx` before editing.

- [ ] **Step 2: Add UserButton and wallet display**

Replace the contents, preserving existing nav links, adding:
```tsx
import { UserButton, useAuth } from '@clerk/react';
import { Link } from 'react-router-dom';
import { useUserStore } from '@/features/user/store/userStore';

// Inside the header JSX, right side:
<div className="flex items-center gap-4">
  <Link to="/history" className="text-sm text-zinc-400 hover:text-white">History</Link>
  <Link to="/billing" className="text-sm text-zinc-400 hover:text-white">
    {balance !== null ? `₹${(balance / 100).toFixed(2)}` : 'Wallet'}
  </Link>
  <UserButton afterSignOutUrl="/sign-in" />
</div>
```

Note: `useUserStore` is created in Task 7. If TypeScript complains before Task 7 is done, use a local `null` placeholder.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add user button and wallet balance to header"
```

---

### Task 7: `GET /api/me` — user upsert on first login

**Files:**
- Create: `netlify/functions/me.mts`
- Create: `src/features/user/store/userStore.ts`
- Create: `src/features/user/hooks/useMe.ts`

- [ ] **Step 1: Write `me.mts`**

```typescript
// netlify/functions/me.mts
import type { Config } from '@netlify/functions';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';
import { v4 as uuidv4 } from 'uuid';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const userId = await requireAuth(req);
    const db = getDb();

    // Upsert user row — idempotent on repeated calls
    await db.execute({
      sql: `INSERT INTO users (id, email, wallet_balance_paise)
            VALUES (?, '', 50000)
            ON CONFLICT(id) DO NOTHING`,
      args: [userId],
    });

    const result = await db.execute({
      sql: 'SELECT id, email, wallet_balance_paise, created_at FROM users WHERE id = ?',
      args: [userId],
    });

    const user = result.rows[0];
    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    console.error('/api/me error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
};

export const config: Config = { path: '/api/me' };
```

- [ ] **Step 2: Create `userStore.ts`**

```typescript
// src/features/user/store/userStore.ts
import { create } from 'zustand';

interface UserState {
  walletBalancePaise: number | null;
  setWalletBalance: (paise: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  walletBalancePaise: null,
  setWalletBalance: (paise) => set({ walletBalancePaise: paise }),
}));
```

- [ ] **Step 3: Create `useMe.ts`**

```typescript
// src/features/user/hooks/useMe.ts
import { useEffect } from 'react';
import { useAuth } from '@clerk/react';
import { useUserStore } from '@/features/user/store/userStore';
import { API_BASE } from '@/lib/constants';

export function useMe() {
  const { getToken, isSignedIn } = useAuth();
  const { walletBalancePaise, setWalletBalance } = useUserStore();

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { wallet_balance_paise: number };
        setWalletBalance(data.wallet_balance_paise);
      }
    })();
  }, [isSignedIn, getToken, setWalletBalance]);

  return { walletBalancePaise };
}
```

- [ ] **Step 4: Call `useMe()` in App.tsx or Layout to bootstrap user data on load**

In `src/components/layout/Layout.tsx`, import and call `useMe()` at the top of the component so balance is fetched once on sign-in.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/me.mts \
  src/features/user/store/userStore.ts \
  src/features/user/hooks/useMe.ts \
  src/components/layout/Layout.tsx
git commit -m "feat: add /api/me endpoint with user upsert and wallet store"
```

---

## Phase 3 — Storage

### Task 8: Extend orchestrator to capture token usage

**Files:**
- Modify: `netlify/functions/lib/types.ts`
- Modify: `netlify/functions/lib/orchestrator.ts`

- [ ] **Step 1: Add `tokenUsage` to `Turn` type**

In `netlify/functions/lib/types.ts`, add to the `Turn` interface:
```typescript
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface Turn {
  turnNumber: number;
  agent: AgentRole;
  response: AgentResponse;
  tokenUsage?: TokenUsage; // populated when metering is active
}
```

- [ ] **Step 2: Read `netlify/functions/lib/agent.ts` to understand how API calls are made**

Read the file to see where `fetch` is called and what the response shape is.

- [ ] **Step 3: Capture token usage in Agent responses**

The Groq/OpenRouter completion response includes `usage.prompt_tokens` and `usage.completion_tokens`. In `agent.ts`, the raw API response needs to be returned alongside the parsed `AgentResponse`.

Update `Agent.respond()` to return `{ response: AgentResponse, usage: TokenUsage }`:
- The return type changes from `Promise<AgentResponse>` to `Promise<{ response: AgentResponse; usage: TokenUsage }>`
- Extract `data.usage.prompt_tokens` and `data.usage.completion_tokens` from the raw API response
- Fall back to `{ promptTokens: 0, completionTokens: 0 }` if usage is absent

- [ ] **Step 4: Update all call sites in `orchestrator.ts`**

Every `await maker.respond(...)` and `await checker.respond(...)` call needs to be updated to destructure `{ response, usage }` and attach `tokenUsage: usage` to the `Turn` object.

- [ ] **Step 5: Run existing tests to verify nothing broke**

```bash
npm test
```
Expected: all existing tests pass

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/lib/types.ts netlify/functions/lib/orchestrator.ts netlify/functions/lib/agent.ts
git commit -m "feat: capture token usage per turn from groq/openrouter api response"
```

---

### Task 9: Wire debate function to save debates + turns + deduct wallet

**Files:**
- Modify: `netlify/functions/debate.mts`

This is the most complex task. Read the full current file before editing.

- [ ] **Step 1: Read `netlify/functions/debate.mts` in full**

Confirm current structure before modifying.

- [ ] **Step 2: Replace `debate.mts` with auth + storage + metering version**

Key changes:
1. Extract auth token → get `userId`
2. Upsert user (in case `/api/me` was never called)
3. Check overdraft limit before starting
4. Create `debates` row at start (status: 'running')
5. In the SSE stream, after each `turn` event: insert `turns` row, calculate cost, deduct wallet, insert `usage_events` row
6. On synthesis/completion: update `debates` row (status: 'completed', synthesis, total_tokens, total_cost_paise)
7. Include `debateId` in the `done` SSE event so frontend can navigate to history

```typescript
// netlify/functions/debate.mts
import type { Config } from '@netlify/functions';
import { runDebate } from './lib/orchestrator.js';
import type { DebateConfig } from './lib/types.js';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';
import { calculateCostPaise, OVERDRAFT_LIMIT_PAISE } from './lib/pricing.js';
import { v4 as uuidv4 } from 'uuid';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'Access-Control-Allow-Origin': '*',
};

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Auth
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: { topic?: string; makerModel?: string; checkerModel?: string; maxTurns?: number; verbose?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { topic, makerModel = 'llama-3.3-70b-versatile', checkerModel = 'llama-3.3-70b-versatile', maxTurns = 8, verbose = false } = body;

  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: 'topic is required' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const db = getDb();

  // Upsert user
  await db.execute({
    sql: `INSERT INTO users (id, email, wallet_balance_paise) VALUES (?, '', 50000) ON CONFLICT(id) DO NOTHING`,
    args: [userId],
  });

  // Check overdraft limit
  const userRow = await db.execute({ sql: 'SELECT wallet_balance_paise FROM users WHERE id = ?', args: [userId] });
  const balance = Number(userRow.rows[0]?.wallet_balance_paise ?? 0);
  if (balance <= OVERDRAFT_LIMIT_PAISE) {
    return new Response(JSON.stringify({ error: 'Insufficient balance. Please top up your wallet.' }), {
      status: 402, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const enableOpenRouter = process.env.ENABLE_OPENROUTER === 'true';
  const openRouterApiKey = enableOpenRouter ? process.env.OPENROUTER_API_KEY : undefined;

  const config: DebateConfig = {
    topic: topic.trim(),
    makerModel,
    checkerModel,
    maxTurns: Math.max(1, Math.min(Number(maxTurns) || 8, 30)),
    verbose: Boolean(verbose),
  };

  // Create debate row
  const debateId = uuidv4();
  await db.execute({
    sql: `INSERT INTO debates (id, user_id, topic, maker_model, checker_model, status)
          VALUES (?, ?, ?, ?, ?, 'running')`,
    args: [debateId, userId, config.topic, config.makerModel, config.checkerModel],
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      let totalTokens = 0;
      let totalCostPaise = 0;

      try {
        for await (const event of runDebate(config, groqApiKey, openRouterApiKey)) {
          if (event.type === 'turn') {
            enqueue(sseMessage('turn', event.data));

            // Persist turn + deduct wallet
            const turn = event.data;
            const usage = turn.tokenUsage ?? { promptTokens: 0, completionTokens: 0 };
            const costPaise = calculateCostPaise(
              turn.agent === 'MAKER' ? config.makerModel : config.checkerModel,
              usage.promptTokens,
              usage.completionTokens,
            );
            const turnId = uuidv4();

            await db.execute({
              sql: `INSERT INTO turns (id, debate_id, turn_number, agent, content, prompt_tokens, completion_tokens, cost_paise)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [turnId, debateId, turn.turnNumber, turn.agent, JSON.stringify(turn.response), usage.promptTokens, usage.completionTokens, costPaise],
            });

            // Atomic deduction
            const deductResult = await db.execute({
              sql: `UPDATE users SET wallet_balance_paise = wallet_balance_paise - ? WHERE id = ?
                    RETURNING wallet_balance_paise`,
              args: [costPaise, userId],
            });
            const balanceAfter = Number(deductResult.rows[0]?.wallet_balance_paise ?? 0);

            await db.execute({
              sql: `INSERT INTO usage_events (id, user_id, debate_id, turn_id, tokens_used, cost_paise, balance_after_paise)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [uuidv4(), userId, debateId, turnId, usage.promptTokens + usage.completionTokens, costPaise, balanceAfter],
            });

            totalTokens += usage.promptTokens + usage.completionTokens;
            totalCostPaise += costPaise;

          } else if (event.type === 'synthesis') {
            enqueue(sseMessage('synthesis', event.data));

            await db.execute({
              sql: `UPDATE debates SET status='completed', synthesis=?, concluded_naturally=?, total_tokens=?, total_cost_paise=?
                    WHERE id=?`,
              args: [
                event.data.synthesis,
                event.data.concludedNaturally ? 1 : 0,
                totalTokens,
                totalCostPaise,
                debateId,
              ],
            });

          } else if (event.type === 'error') {
            enqueue(sseMessage('error', event.data));
            await db.execute({
              sql: `UPDATE debates SET status='failed' WHERE id=?`,
              args: [debateId],
            });
          }
        }

        enqueue(sseMessage('done', { debateId }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        enqueue(sseMessage('error', { message }));
        enqueue(sseMessage('done', { debateId }));
        await db.execute({ sql: `UPDATE debates SET status='failed' WHERE id=?`, args: [debateId] });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};

export const config: Config = { path: '/api/debate' };
```

- [ ] **Step 3: Update `src/lib/api.ts` to send auth header**

In `streamDebate`, add token passing:
```typescript
export async function* streamDebate(
  config: DebateConfig,
  token: string,           // NEW: Clerk JWT
  signal?: AbortSignal
): AsyncGenerator<{ type: string; data: unknown }> {
  const response = await fetch(`${API_BASE}/debate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,   // NEW
    },
    body: JSON.stringify(config),
    signal,
  });
  // ... rest unchanged
}
```

- [ ] **Step 4: Update `useDebate.ts` to pass token**

In `src/features/debate/hooks/useDebate.ts`, get the Clerk token and pass it to `streamDebate`:
```typescript
import { useAuth } from '@clerk/react';
// Inside useDebate():
const { getToken } = useAuth();
// Inside startDebate():
const token = await getToken();
if (!token) throw new Error('Not authenticated');
const generator = streamDebate(config, token, controller.signal);
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

- [ ] **Step 6: Build check**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/debate.mts src/lib/api.ts src/features/debate/hooks/useDebate.ts
git commit -m "feat: add auth + per-turn token metering + debate persistence to debate function"
```

---

### Task 10: History endpoints + History page

**Files:**
- Create: `netlify/functions/debates.mts`
- Create: `netlify/functions/debate-detail.mts`
- Modify: `src/pages/HistoryPage.tsx`
- Create: `src/features/history/components/DebateList.tsx`
- Create: `src/features/history/components/DebateDetail.tsx`

- [ ] **Step 1: Write `debates.mts` (list)**

```typescript
// netlify/functions/debates.mts
import type { Config } from '@netlify/functions';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const userId = await requireAuth(req);
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT id, topic, maker_model, checker_model, status, total_tokens, total_cost_paise, created_at
            FROM debates WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      args: [userId],
    });
    return new Response(JSON.stringify(result.rows), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError)
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};

export const config: Config = { path: '/api/debates' };
```

- [ ] **Step 2: Write `debate-detail.mts` (single debate with turns)**

```typescript
// netlify/functions/debate-detail.mts
import type { Config } from '@netlify/functions';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const userId = await requireAuth(req);
    const url = new URL(req.url);
    const debateId = url.pathname.split('/').pop();

    const db = getDb();
    const debateResult = await db.execute({
      sql: 'SELECT * FROM debates WHERE id = ? AND user_id = ?',
      args: [debateId, userId],
    });
    if (!debateResult.rows.length) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const turnsResult = await db.execute({
      sql: 'SELECT * FROM turns WHERE debate_id = ? ORDER BY turn_number ASC',
      args: [debateId],
    });

    return new Response(JSON.stringify({ debate: debateResult.rows[0], turns: turnsResult.rows }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError)
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};

export const config: Config = { path: '/api/debates/:id' };
```

- [ ] **Step 3: Add `/api/debates` and `/api/debates/:id` to `netlify.toml` redirects**

Before the catch-all `/*` redirect, add:
```toml
[[redirects]]
  from   = "/api/debates/:id"
  to     = "/.netlify/functions/debate-detail"
  status = 200

[[redirects]]
  from   = "/api/debates"
  to     = "/.netlify/functions/debates"
  status = 200
```

- [ ] **Step 4: Build `HistoryPage`**

```tsx
// src/pages/HistoryPage.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'react-router-dom';
import { API_BASE } from '@/lib/constants';

interface DebateSummary {
  id: string;
  topic: string;
  maker_model: string;
  checker_model: string;
  status: string;
  total_cost_paise: number;
  created_at: string;
}

export default function HistoryPage() {
  const { getToken } = useAuth();
  const [debates, setDebates] = useState<DebateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/debates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDebates(await res.json() as DebateSummary[]);
      setLoading(false);
    })();
  }, [getToken]);

  if (loading) return <div className="p-8 text-zinc-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Debate History</h1>
      {debates.length === 0 && (
        <p className="text-zinc-400">No debates yet. <Link to="/" className="text-indigo-400 hover:underline">Start one.</Link></p>
      )}
      <ul className="space-y-3">
        {debates.map(d => (
          <li key={d.id} className="bg-zinc-800 rounded-lg p-4">
            <p className="text-white font-medium truncate">{d.topic}</p>
            <p className="text-zinc-400 text-sm mt-1">
              {d.maker_model} vs {d.checker_model} · ₹{(d.total_cost_paise / 100).toFixed(2)} · {new Date(d.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Build check**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/debates.mts netlify/functions/debate-detail.mts \
  src/pages/HistoryPage.tsx netlify.toml
git commit -m "feat: add debate history endpoints and history page"
```

---

## Phase 4 — Billing

### Task 11: Token pack config + Razorpay order creation

**Files:**
- Create: `netlify/functions/lib/packs.ts`
- Create: `netlify/functions/create-order.mts`

- [ ] **Step 1: Write failing test for packs**

```typescript
// netlify/functions/lib/__tests__/packs.test.ts
import { describe, it, expect } from 'vitest';
import { TOKEN_PACKS, getPackOrThrow } from '../packs.js';

describe('TOKEN_PACKS', () => {
  it('has small, standard, and power packs', () => {
    expect(TOKEN_PACKS.small).toBeDefined();
    expect(TOKEN_PACKS.standard).toBeDefined();
    expect(TOKEN_PACKS.power).toBeDefined();
  });

  it('all packs have amount_paise > 0', () => {
    for (const pack of Object.values(TOKEN_PACKS)) {
      expect(pack.amount_paise).toBeGreaterThan(0);
    }
  });
});

describe('getPackOrThrow', () => {
  it('returns pack for valid key', () => {
    expect(getPackOrThrow('small')).toBe(TOKEN_PACKS.small);
  });

  it('throws for unknown pack', () => {
    expect(() => getPackOrThrow('unicorn')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- netlify/functions/lib/__tests__/packs.test.ts
```

- [ ] **Step 3: Write `packs.ts`**

```typescript
// netlify/functions/lib/packs.ts
export const TOKEN_PACKS = {
  small:    { amount_paise:  4900, label: '₹49'  },
  standard: { amount_paise: 14900, label: '₹149' },
  power:    { amount_paise: 39900, label: '₹399' },
} as const;

export type PackKey = keyof typeof TOKEN_PACKS;

export function getPackOrThrow(key: string): (typeof TOKEN_PACKS)[PackKey] {
  if (!(key in TOKEN_PACKS)) throw new Error(`Unknown pack: ${key}`);
  return TOKEN_PACKS[key as PackKey];
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test -- netlify/functions/lib/__tests__/packs.test.ts
```

- [ ] **Step 5: Write `create-order.mts`**

```typescript
// netlify/functions/create-order.mts
import type { Config } from '@netlify/functions';
import Razorpay from 'razorpay';
import { requireAuth, AuthError } from './lib/auth.js';
import { getDb } from './lib/db.js';
import { getPackOrThrow } from './lib/packs.js';
import { v4 as uuidv4 } from 'uuid';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const userId = await requireAuth(req);
    const { pack } = (await req.json()) as { pack?: string };
    if (!pack) {
      return new Response(JSON.stringify({ error: 'pack is required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const packDef = getPackOrThrow(pack);

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: packDef.amount_paise,
      currency: 'INR',
      receipt: uuidv4(),
    });

    const db = getDb();
    const paymentId = uuidv4();
    await db.execute({
      sql: `INSERT INTO payments (id, user_id, razorpay_order_id, amount_paise, status)
            VALUES (?, ?, ?, ?, 'pending')`,
      args: [paymentId, userId, order.id, packDef.amount_paise],
    });

    return new Response(JSON.stringify({ order_id: order.id, amount: packDef.amount_paise, currency: 'INR' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof AuthError)
      return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    console.error('/api/create-order error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};

export const config: Config = { path: '/api/create-order' };
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/lib/packs.ts netlify/functions/lib/__tests__/packs.test.ts netlify/functions/create-order.mts
git commit -m "feat: add token pack config and razorpay order creation endpoint"
```

---

### Task 12: Razorpay webhook — HMAC verify + wallet top-up

**Files:**
- Create: `netlify/functions/razorpay-webhook.mts`
- Create: `netlify/functions/lib/__tests__/hmac.test.ts`

- [ ] **Step 1: Write HMAC verification test**

```typescript
// netlify/functions/lib/__tests__/hmac.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyRazorpaySignature } from '../hmac.js';

describe('verifyRazorpaySignature', () => {
  const secret = 'test_secret';
  const body = '{"event":"payment.captured"}';

  it('returns true for valid signature', () => {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(body, sig, secret)).toBe(true);
  });

  it('returns false for wrong signature', () => {
    expect(verifyRazorpaySignature(body, 'badsig', secret)).toBe(false);
  });

  it('returns false for empty signature', () => {
    expect(verifyRazorpaySignature(body, '', secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- netlify/functions/lib/__tests__/hmac.test.ts
```

- [ ] **Step 3: Create `netlify/functions/lib/hmac.ts`**

```typescript
// netlify/functions/lib/hmac.ts
import crypto from 'crypto';

export function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npm test -- netlify/functions/lib/__tests__/hmac.test.ts
```

- [ ] **Step 5: Write `razorpay-webhook.mts`**

```typescript
// netlify/functions/razorpay-webhook.mts
import type { Config } from '@netlify/functions';
import { getDb } from './lib/db.js';
import { verifyRazorpaySignature } from './lib/hmac.js';

const CORS = { 'Content-Type': 'application/json' };

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;

  if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: CORS });
  }

  let payload: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS });
  }

  // Only handle payment.captured
  if (payload.event !== 'payment.captured') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  }

  const orderId = payload.payload?.payment?.entity?.order_id;
  const razorpayPaymentId = payload.payload?.payment?.entity?.id;

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Missing order_id' }), { status: 400, headers: CORS });
  }

  const db = getDb();

  // Look up payment row
  const paymentResult = await db.execute({
    sql: 'SELECT id, user_id, amount_paise, status FROM payments WHERE razorpay_order_id = ?',
    args: [orderId],
  });

  if (!paymentResult.rows.length) {
    console.error('Webhook: payment row not found for order', orderId);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS }); // Idempotent
  }

  const payment = paymentResult.rows[0];

  // Idempotent — already processed
  if (payment.status === 'success') {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
  }

  const amountPaise = Number(payment.amount_paise);

  // Top up wallet + mark payment success atomically
  await db.batch([
    {
      sql: `UPDATE users SET wallet_balance_paise = wallet_balance_paise + ? WHERE id = ?`,
      args: [amountPaise, payment.user_id],
    },
    {
      sql: `UPDATE payments SET status='success', razorpay_payment_id=? WHERE id=?`,
      args: [razorpayPaymentId ?? null, payment.id],
    },
  ]);

  console.log(`Wallet topped up: user=${payment.user_id} +${amountPaise} paise`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
};

export const config: Config = { path: '/api/razorpay-webhook' };
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/razorpay-webhook.mts netlify/functions/lib/hmac.ts netlify/functions/lib/__tests__/hmac.test.ts
git commit -m "feat: add razorpay webhook with hmac verification and wallet top-up"
```

---

### Task 13: Billing page UI

**Files:**
- Modify: `src/pages/BillingPage.tsx`

The billing page needs: current wallet balance, top-up pack buttons, Razorpay checkout flow.

- [ ] **Step 1: Add Razorpay checkout script to `index.html`**

In `index.html`, before the closing `</body>` tag:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

- [ ] **Step 2: Add Razorpay type declaration**

Create `src/types/razorpay.d.ts`:
```typescript
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
}

declare class Razorpay {
  constructor(options: RazorpayOptions);
  open(): void;
}
```

- [ ] **Step 3: Write `BillingPage.tsx`**

```tsx
// src/pages/BillingPage.tsx
import { useState } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { useUserStore } from '@/features/user/store/userStore';
import { useMe } from '@/features/user/hooks/useMe';
import { API_BASE } from '@/lib/constants';

const PACKS = [
  { key: 'small',    label: '₹49',  description: '~50 debates on free models' },
  { key: 'standard', label: '₹149', description: '~150 debates on free models' },
  { key: 'power',    label: '₹399', description: '~400 debates on free models' },
];

export default function BillingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { walletBalancePaise } = useMe();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleTopUp(packKey: string) {
    setLoading(packKey);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pack: packKey }),
      });
      const { order_id, amount } = await res.json() as { order_id: string; amount: number };

      const rzp = new Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID as string,
        amount,
        currency: 'INR',
        order_id,
        name: 'botroom',
        description: 'Wallet top-up',
        handler: () => {
          // Payment captured — webhook will update balance server-side
          // Poll /api/me after a short delay to refresh UI
          setTimeout(async () => {
            const t = await getToken();
            const r = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${t}` } });
            if (r.ok) {
              const data = await r.json() as { wallet_balance_paise: number };
              useUserStore.getState().setWalletBalance(data.wallet_balance_paise);
            }
          }, 2000);
        },
        prefill: { email: user?.primaryEmailAddress?.emailAddress },
        theme: { color: '#6366f1' },
      });
      rzp.open();
    } finally {
      setLoading(null);
    }
  }

  const balanceInr = walletBalancePaise !== null ? (walletBalancePaise / 100).toFixed(2) : '...';
  const isNegative = (walletBalancePaise ?? 0) < 0;

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Wallet</h1>
      <p className={`text-3xl font-bold mb-8 ${isNegative ? 'text-red-400' : 'text-green-400'}`}>
        ₹{balanceInr}
      </p>
      {isNegative && (
        <p className="text-red-400 text-sm mb-6">Your balance is negative. Top up to run more debates.</p>
      )}
      <h2 className="text-lg font-semibold text-zinc-300 mb-4">Top up</h2>
      <div className="grid gap-3">
        {PACKS.map(pack => (
          <button
            key={pack.key}
            onClick={() => handleTopUp(pack.key)}
            disabled={loading === pack.key}
            className="flex justify-between items-center bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg p-4 transition disabled:opacity-50"
          >
            <span className="font-semibold text-lg">{pack.label}</span>
            <span className="text-zinc-400 text-sm">{pack.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build check**

```bash
npm run typecheck && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/BillingPage.tsx src/types/razorpay.d.ts index.html
git commit -m "feat: add billing page with razorpay checkout integration"
```

---

## Phase 5 — Final Wiring & Verification

### Task 14: Run migration + end-to-end smoke test checklist

This task is manual steps + verification.

- [ ] **Step 1: Set up environment variables**

In Netlify dashboard → Site settings → Environment variables, add all variables from `.claude/PLAN.md` env section. Also add to local `.env` for dev testing.

- [ ] **Step 2: Run DB migration**

```bash
npm run migrate
```
Expected: 5 tables created, `Migration complete.`

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Build**

```bash
npm run build
```
Expected: clean build in `dist/`

- [ ] **Step 6: Smoke test locally with `netlify dev`**

```bash
npx netlify dev
```
- Sign in with Clerk → should redirect to `/`
- Start a debate → should stream turns, see balance decrease in header
- Check `/history` → debate should appear
- Check `/billing` → balance shown, click a pack → Razorpay modal opens
- (Use Razorpay test mode keys for local testing)

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: final wiring, env var docs, smoke test verified"
```

---

### Task 15: Create PR to staging

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/auth-storage-billing
```

- [ ] **Step 2: Create PR targeting `staging`** (per CLAUDE.md protocol — never directly to `main`)

```bash
gh pr create \
  --base staging \
  --title "feat: add Clerk auth, Turso storage, and Razorpay billing" \
  --body "Implements the full auth + storage + billing stack as designed in .claude/PLAN.md.

## What's included
- Clerk auth with Google SSO, route guard, UserButton in header
- Turso libSQL: users, debates, turns, usage_events, payments tables
- Per-turn token metering with 2× markup, wallet balance in paise
- Razorpay prepaid wallet: create-order, webhook HMAC verification, top-up
- History page (list + detail), Billing page with pack selection
- Pricing unit tests, HMAC unit tests, pack config unit tests

## Checklist
- [ ] CI: npm run build passes
- [ ] CI: npm test passes
- [ ] CI: npm run typecheck passes
- [ ] Env vars added in Netlify dashboard
- [ ] DB migration run against Turso
- [ ] Smoke tested locally with netlify dev"
```

- [ ] **Step 3: Wait for CI to pass, then request human review**

---

## Environment Variables Checklist

Before any deployment, confirm ALL of the following are set in Netlify:

```
VITE_CLERK_PUBLISHABLE_KEY      ← from Clerk dashboard
CLERK_SECRET_KEY                ← from Clerk dashboard
TURSO_DATABASE_URL              ← from Turso dashboard (libsql://...)
TURSO_AUTH_TOKEN                ← from Turso dashboard
GROQ_API_KEY                    ← already set
RAZORPAY_KEY_ID                 ← from Razorpay dashboard
RAZORPAY_KEY_SECRET             ← from Razorpay dashboard
RAZORPAY_WEBHOOK_SECRET         ← set when creating webhook in Razorpay dashboard
VITE_RAZORPAY_KEY_ID            ← same as RAZORPAY_KEY_ID (public, safe to expose)
```

**Razorpay webhook URL to register:** `https://your-netlify-site.netlify.app/api/razorpay-webhook`

Events to subscribe: `payment.captured` only.
