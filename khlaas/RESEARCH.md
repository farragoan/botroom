# khlaas — Technical Literature Review

> OCR-powered per-item bill splitting: scan a receipt, everyone selects what they ate, we do the math.

---

## Product Overview

**Core flow (V1):**
1. User photos a restaurant bill
2. OCR extracts line items (name + price), subtotal, tax, service charges
3. User creates a **table** (split session) — generates a shareable link
4. Each person joins the link and taps the dishes they ate (multiselect)
5. App calculates each person's exact share: their items + proportional share of fees
6. Records a "who owes who" ledger — no payment processing in V1

**Roadmap:**
- **V1** — Single bill split, no accounts, join by link (ephemeral)
- **V2** — Persistent ledger across bills, user accounts
- **V3** — Long-running groups (Splitwise-style), continuous group splits
- **V4** — Expo/React Native mobile app, shared monorepo with web

---

## 1. OCR Approaches

### Decision Matrix

| Approach | Cost/receipt | Accuracy on restaurant bills | Structured output | Latency | Notes |
|---|---|---|---|---|---|
| Tesseract 5.x | Free | 60–80% raw, ~90% with preprocessing | ❌ (raw text) | 1–3s CPU | Needs heavy post-processing |
| PaddleOCR PP-OCRv4 | Free | ~94% word-level (SROIE benchmark) | Partial (PPStructure) | 2–5s CPU, 200–500ms GPU | Best open-source option |
| Google Vision API | $0.0015 | Excellent | ❌ (bounding boxes only) | 1–2s | No receipt semantics |
| **AWS Textract AnalyzeExpense** | **$0.01** | **~92–97% on prices, ~80% on item names** | **✅ (ITEM, PRICE, TAX, TOTAL)** | **2–4s** | **Best structured output** |
| Azure Document Intelligence | $0.01 (500 free/mo) | ~92% field F1 | ✅ (prebuilt-receipt model) | 2–4s | Better on European receipts |
| Claude 3.5 Haiku | ~$0.002–0.005 | 90–97% + semantic normalization | ✅ (prompt → JSON) | 1–4s | Handles abbreviations, handwriting |
| GPT-4o-mini | ~$0.001–0.003 | Similar to Haiku | ✅ | 2–5s | |

### Recommended Approach: Hybrid (Textract + LLM fallback)

```
Phone image
    │
    ▼
Preprocessing (deskew, CLAHE, binarize)  ← sharp + OpenCV
    │
    ▼
AWS Textract AnalyzeExpense  ($0.01/receipt)
    │
    ├─ Confidence ≥ 85% AND total field present? ──► Return structured items
    │
    └─ Low confidence OR missing total OR item count = 0?
            │
            ▼
        Claude 3.5 Haiku fallback  (~$0.003/receipt)
            │
            ▼
        Return structured JSON
```

**Fallback triggers:**
- Any field confidence < 85 (Textract provides per-field float)
- `TOTAL` field missing from SummaryFields
- Sum of extracted item prices differs from TOTAL by > 5%
- Item count = 0

**Economics at 10,000 receipts/month:**
- 80% via Textract: $80
- 20% via Haiku fallback: $6
- **Total OCR cost: ~$86/month**

### Textract AnalyzeExpense — Output Structure

```json
{
  "LineItemGroups": [{
    "LineItems": [{
      "LineItemExpenseFields": [
        {"Type": {"Text": "ITEM"}, "ValueDetection": {"Text": "Pad Thai", "Confidence": 94.2}},
        {"Type": {"Text": "PRICE"}, "ValueDetection": {"Text": "12.50", "Confidence": 99.1}}
      ]
    }]
  }],
  "SummaryFields": [
    {"Type": {"Text": "TAX"}, "ValueDetection": {"Text": "1.13"}},
    {"Type": {"Text": "SERVICE_CHARGE"}, "ValueDetection": {"Text": "2.00"}},
    {"Type": {"Text": "TOTAL"}, "ValueDetection": {"Text": "27.63"}}
  ]
}
```

SDK: `@aws-sdk/client-textract` → `AnalyzeExpenseCommand`

### Claude Haiku Fallback — Prompt

```
Extract all line items from this receipt image. Return JSON only, no other text:
{
  "items": [{"name": string, "quantity": number, "unit_price": number, "total_price": number}],
  "subtotal": number | null,
  "tax": number | null,
  "service_charge": number | null,
  "other_fees": [{"name": string, "amount": number}],
  "total": number | null
}
```

**Key advantage of LLM fallback:** Semantic normalization — "CHKN PAD TH × 2" becomes `{"name": "Chicken Pad Thai", "quantity": 2, "unit_price": 12.50}`. Textract does not normalize.

### Image Preprocessing Pipeline

Required for any traditional OCR (less critical for LLM-based):

1. **Perspective warp** — OpenCV `findContours` → `getPerspectiveTransform` (correct receipt held at angle)
2. **Grayscale**
3. **CLAHE** — `equalizeHist`, tile 8×8, clip limit 2.0 (handle uneven lighting)
4. **Sauvola adaptive threshold** — window 25px, k=0.2 (outperforms Otsu on thermal receipts)
5. **Morphological dilation** — 1px horizontal kernel (reconnect broken thermal print characters)
6. **Upscale to 300 DPI** if below threshold

**Node.js implementation:** `sharp` (fast) + `opencv4nodejs` (for perspective correction)
**Browser-side option:** `opencv.js` (WASM, ~30MB) + `Tesseract.js` — runs fully client-side, eliminates upload latency

### Open-Source Datasets & Fine-Tuned Models

| Resource | Description | Relevance |
|---|---|---|
| [CORD dataset](https://github.com/clovaai/cord) | 11,000 SE Asian restaurant receipts, 30 semantic fields | Direct — matches khlaas restaurant use case |
| [SROIE (ICDAR 2019)](https://rrc.cvc.uab.es/?ch=13) | 1,000 receipts, key-value labels | Benchmark standard |
| [LayoutLMv3](https://arxiv.org/abs/2204.08387) | Transformer: text + layout + image, fine-tune on CORD | State-of-the-art receipt parsing if self-hosting |
| [Donut (Clova)](https://arxiv.org/abs/2111.15664) | End-to-end: image → JSON, no separate OCR step | `naver-clova-ix/donut-base-finetuned-cord-v2` on HuggingFace — turnkey for V2+ |
| PaddleOCR PP-OCRv4 | Open-source, DBNet detector + CRNN/SVTR | Best open-source if avoiding per-call costs |

**V2 self-hosted path:** Fine-tune Donut on CORD + 500–1,000 labeled khlaas receipts → deploy on a $50/month GPU instance → eliminates per-call OCR costs entirely at scale.

---

## 2. Web App Tech Stack

### Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | PWA support, colocated API routes, V4 React Native transition via shared React |
| **Styling** | Tailwind CSS + shadcn/ui | Fast UI iteration, accessible components, no runtime CSS overhead |
| **Real-time** | Supabase Realtime | Already in stack — zero extra infra for live table selection |
| **Database** | Supabase (PostgreSQL) | RLS, Realtime, Storage, Auth — all-in-one, no glue code |
| **Auth** | None (V1) → Supabase Auth (V2) | Phased migration, no schema changes needed |
| **OCR** | AWS Textract + Claude Haiku fallback | Best structured output, graceful degradation |
| **Image storage** | Cloudflare R2 | Zero egress fees (critical when receipt images are viewed repeatedly) |
| **Background jobs** | Inngest (free tier) | Async OCR pipeline, TTL cleanup cron |
| **Hosting** | Vercel | First-class Next.js, preview deployments, edge functions |
| **Monorepo (V4)** | Turborepo + pnpm workspaces | Web + Expo with shared business logic |

### Frontend: Next.js vs Alternatives

| Framework | PWA | Camera | Real-time | Bundle | V4 mobile transition |
|---|---|---|---|---|---|
| **Next.js** | Excellent (Serwist) | Native | Good | Medium | Best (shared React hooks) |
| SvelteKit | Excellent | Native | Good | Smallest | Poor (different paradigm) |
| Remix | Good | Native | Manual | Medium | Mediocre |
| React SPA (Vite) | Good | Native | Good | Small | Good (same React) |

Next.js wins on the V4 code-sharing story — same React primitives, same `@tanstack/query` hooks, same Zod schemas work in Expo.

### Real-Time Collaboration: Supabase Realtime

The "table" feature (multiple users simultaneously selecting dishes) needs live sync.

**Why Supabase Realtime:**
- Built on Phoenix Channels (Elixir) — scales to 200k+ concurrent connections
- `postgres_changes` subscription: DB is the single source of truth, no separate state layer
- `channel.track()` for presence (show who's joined the table)
- Free tier: 500 concurrent connections — plenty for V1
- SDK: 15 lines to implement selection sync

```typescript
const channel = supabase.channel(`table:${tableId}`)
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'selections', filter: `table_id=eq.${tableId}` },
    (payload) => updateSelectionState(payload.new)
  )
  .subscribe()
```

**PartyKit** is better at very high concurrency and gives more control over conflict resolution — consider for V3 when groups get large.

### Camera Access in PWA

**V1 — Use `<input capture>` (maximum compatibility, zero friction):**
```html
<input type="file" accept="image/*" capture="environment" />
```
Triggers rear camera directly. Works on iOS Safari 14.5+, all Android Chrome. No JS required.

**V2 — `getUserMedia` for live preview + auto-capture:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment', width: { ideal: 1920 } }
})
```
Enables: live preview, auto-capture when receipt fills frame, edge detection overlay.
Use `react-webcam` (npm) to abstract this.

### Database: Supabase

| Option | Type | Real-time | RLS | Price |
|---|---|---|---|---|
| **Supabase** | Postgres | ✅ built-in | ✅ | Free → $25/mo |
| PlanetScale | MySQL | ❌ | ❌ | Paid only (free tier removed) |
| Turso | SQLite edge | ❌ | ❌ | Free → $29/mo |
| Firebase | NoSQL | ✅ | Partial | Free → pay-as-go |

Supabase wins: RLS enables "only table participants can read/write their table's data" with zero application-level auth code.

### Image Storage: Cloudflare R2

| Service | Storage | Egress | Notes |
|---|---|---|---|
| **Cloudflare R2** | $0.015/GB/mo | **Free** | S3-compatible API |
| Supabase Storage | $0.021/GB/mo | $0.09/GB | Simpler integration |
| AWS S3 | $0.023/GB/mo | $0.09/GB | Standard |

At 10,000 receipts × 1MB × 5 views = 50GB egress/month: **R2 = $0, S3 = $4.50**. Use `@aws-sdk/client-s3` pointed at R2 endpoint — S3-compatible, zero code change.

**Receipt lifecycle:** Delete raw images after 30 days (or when table expires). Retain only the structured JSON. Reduces costs and privacy surface.

### Async OCR Pipeline

OCR takes 3–10 seconds — too long for a synchronous API response. Use a job queue:

```
Client → POST /api/receipts/upload → {jobId, uploadUrl}
Client → PUT image to R2 presigned URL
Server → enqueue Inngest job
Inngest → runs OCR → writes items to DB
Supabase Realtime → broadcasts "receipt:processed" to table channel
Client → renders item list
```

**Inngest** free tier: 50,000 function runs/month. Handles retries, error handling, delays automatically.

### Infrastructure Cost at Scale

| Scale | Supabase | Textract | R2 | Vercel | Inngest | Total |
|---|---|---|---|---|---|---|
| 1,000 tables/mo | Free | ~$10 | ~$0.50 | Free | Free | **~$11** |
| 10,000 tables/mo | Free | ~$86 | ~$2 | Free | Free | **~$90** |
| 100,000 tables/mo | $25 | ~$860 | ~$15 | $20 | $0 | **~$920** |

---

## 3. Table Feature Architecture

### 3.1 Ephemeral vs Persistent

Tables use **soft-expiry**:
- Default TTL: 7 days after last activity
- Background job (Inngest cron or `pg_cron`) marks `status: 'expired'`
- On expiry: receipt image deleted from R2, structured data retained in DB
- Users can "close" a table manually (triggers ledger computation)
- V2: closed tables attach to user profile for history

### 3.2 Item Selection: No Conflict Needed

Selections are **non-exclusive and additive**:
- Multiple people can select the same item → cost split equally among all who selected it
- "2 people selected Pad Thai" = each pays 50% of Pad Thai
- No conflict resolution needed — each participant has their own `selections` rows

**Optimistic UI:**
1. Tap checkbox → local state updates immediately
2. POST `/api/selections` fires in background
3. Supabase broadcasts insert to all participants
4. On error: revert state + toast

### 3.3 Database Schema

```sql
-- A bill split session
CREATE TABLE split_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code  TEXT UNIQUE NOT NULL,        -- short URL slug: /t/abc123
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  status      TEXT DEFAULT 'active',       -- active | settled | expired
  receipt_url TEXT,                        -- R2 object key
  raw_ocr     JSONB                        -- cached OCR response
);

-- Line items from receipt
CREATE TABLE items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID REFERENCES split_tables(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  unit_price  NUMERIC(10,2) NOT NULL,
  quantity    INTEGER DEFAULT 1,
  total_price NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  sort_order  INTEGER,
  is_fee      BOOLEAN DEFAULT FALSE        -- TRUE for tax, service charge, tip
);

-- Participants (V1: anonymous via session token; V2: linked to auth.users)
CREATE TABLE participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id      UUID REFERENCES split_tables(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  user_id       UUID REFERENCES auth.users(id),  -- NULL in V1
  session_token TEXT,                             -- client-generated ephemeral ID
  joined_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Who ate what (many-to-many)
CREATE TABLE selections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID REFERENCES participants(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES items(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, item_id)
);

-- Final ledger (computed when table settles)
CREATE TABLE ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id         UUID REFERENCES split_tables(id),
  from_participant UUID REFERENCES participants(id),
  to_participant   UUID REFERENCES participants(id),
  amount           NUMERIC(10,2) NOT NULL,
  settled          BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 Ledger Computation Algorithm

```
1. For each non-fee item:
   selectors = participants who selected this item
   per_person_share = item.total_price / selectors.count
   assign share to each selector

2. For each fee item (tax, service_charge, tip):
   each participant pays: fee.amount × (participant_subtotal / grand_subtotal)

3. Debt simplification (minimize transaction count):
   net_balances = {participant_id: net_amount_owed}
   while creditors and debtors remain:
     match largest debtor with largest creditor
     record payment, reduce balances
     insert into ledger_entries
```

---

## 4. Roadmap

### V1 — Single Bill, No Accounts (~2 months)
- Table join by UUID link (`/t/{uuid}`) — no auth required
- Participant identity: `localStorage` + session cookie `{participantId, displayName}`
- OCR: Textract + Haiku fallback via Inngest async job
- Real-time selection via Supabase Realtime
- Ledger computation on demand
- RLS: tables readable by anyone with `share_code`; selections writable with valid `session_token`

### V2 — Persistent Ledger (~2 months after V1)
- Supabase Auth: email magic link + Google OAuth
- `participants.user_id` FK populated for logged-in users
- `contacts` table: user → user relationships with running balance
- Dashboard: "You owe Alex $47 across 3 bills"
- Push notifications via web push (service worker)

### V3 — Long-Running Groups (~3 months after V2)
- `groups` table with members
- `split_tables.group_id` FK
- Group-level debt simplification across all bills
- Consider Clerk for organization/group management UI
- Recurring split templates

### V4 — Mobile App (Expo)
- Turborepo monorepo: `apps/web` (Next.js) + `apps/mobile` (Expo)
- Shared: `packages/core` (ledger calc, API client, Zod schemas), `packages/ui` (design tokens)
- Camera: `expo-camera` on mobile (replaces `getUserMedia`)
- Navigation: `expo-router` (file-based, similar mental model to Next.js App Router)
- Styling: NativeWind (Tailwind CSS for React Native) — share class names with web

---

## 5. Competitive Landscape

### Direct Competitors

| App | OCR | Per-item selection | Real-time collab | Web PWA | No account needed |
|---|---|---|---|---|---|
| **khlaas** | ✅ (Textract + LLM) | ✅ | ✅ | ✅ | ✅ (V1) |
| Splitwise | Partial (total only) | ❌ | ❌ | ✅ | ❌ |
| Tricount | ❌ | ❌ | ❌ | ✅ | ✅ |
| Settle Up | ✅ (ML Kit, native only) | ✅ (sequential) | ❌ | ❌ | ❌ |
| Tab | ✅ | ✅ | ✅ | ❌ (native only) | ❌ |

**Key differentiators vs. closest competitor (Tab / Settle Up):**
1. **Web-first PWA** — no install required (critical for casual one-time dinner splits)
2. **Real-time collaborative selection** — everyone taps simultaneously, not one-at-a-time
3. **No accounts in V1** — join by link, done
4. **LLM fallback** — handles stylized menus, abbreviations, mixed scripts

### Why Per-Item Splitting Wins

The innovation is **"I point at what I ate"** — it digitizes the natural ritual of splitting a restaurant check. Current alternatives force one of:
- Equal split → unfair when orders differ significantly
- Manual amount entry → error-prone, requires mental math, social awkwardness  
- "I'll pay, you Venmo me" → asynchronous, often forgotten

Per-item selection is fair, frictionless, and fun. The collaborative real-time aspect (everyone on their own phone, seeing the same receipt) makes it a shared group experience at the table.

---

## 6. Key References

- [CORD dataset paper](https://arxiv.org/abs/2103.10213) — Park et al., 2019
- [SROIE competition](https://rrc.cvc.uab.es/?ch=13) — ICDAR 2019
- [LayoutLMv3](https://arxiv.org/abs/2204.08387) — Microsoft, 2022
- [Donut (OCR-free)](https://arxiv.org/abs/2111.15664) — Clova AI, 2022
- [PaddleOCR PP-OCRv4](https://arxiv.org/abs/2309.03799) — Baidu, 2023
- [HuggingFace: Donut fine-tuned on CORD](https://huggingface.co/naver-clova-ix/donut-base-finetuned-cord-v2)
- [AWS Textract AnalyzeExpense](https://docs.aws.amazon.com/textract/latest/dg/analyzing-document-expense.html)
- [Azure Document Intelligence receipt model](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/receipt)
- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
- [PartyKit GitHub](https://github.com/partykit/partykit) — alternative real-time layer for V3+
- [Inngest GitHub](https://github.com/inngest/inngest) — async job queue
