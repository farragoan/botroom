# khlaas — Architecture Overview

## System Diagram

```
Browser (PWA)
    │
    │  HTTPS
    ▼
Vercel Edge (Next.js App Router)
    │
    ├── /app/api/tables/*      ← CRUD for split tables
    ├── /app/api/receipts/*    ← upload + trigger OCR job
    ├── /app/api/selections/*  ← item selection writes
    └── /app/api/ledger/*      ← settle + compute ledger
         │
         ├── Supabase (PostgreSQL)   ← all persistent state
         │     └── Realtime          ← live selection sync to all participants
         │
         ├── Cloudflare R2           ← receipt image storage
         │
         └── Inngest                 ← async OCR job queue
               │
               ├── AWS Textract AnalyzeExpense   ← primary OCR
               └── Claude 3.5 Haiku              ← fallback OCR
```

## Key Flows

### 1. Create Table + Scan Receipt

```
1.  Host opens app → POST /api/tables → {tableId, shareCode}
2.  Host takes photo → PUT image to R2 presigned URL
3.  POST /api/receipts/process → enqueues Inngest job → returns immediately
4.  Inngest job:
      a. Fetch image from R2
      b. Run Textract AnalyzeExpense
      c. If low confidence → run Claude Haiku fallback
      d. Parse items + fees → insert into `items` table
      e. Update split_tables.status = 'items_ready'
5.  Supabase Realtime broadcasts 'items_ready' to table channel
6.  Host's browser receives event → renders item list
```

### 2. Join Table + Select Items

```
1.  Guest opens /t/{shareCode}
2.  GET /api/tables/{shareCode} → table + items
3.  Guest enters display name → POST /api/participants → {participantId, sessionToken}
    (sessionToken stored in localStorage)
4.  Guest subscribes to Supabase channel 'table:{tableId}'
5.  Guest taps checkbox:
      a. Optimistic update: check immediately in local state
      b. POST /api/selections → {participantId, itemId}
      c. Supabase broadcasts INSERT to all participants
      d. All browsers update their view
      e. On error: revert + show toast
```

### 3. Settle Table

```
1.  Host clicks "Settle Up"
2.  POST /api/ledger/compute → server-side calculation:
      a. Per item: cost / number of selectors → assign to each selector
      b. Per fee: distribute proportional to participant subtotals
      c. Debt simplification: minimize transaction count
      d. Insert into ledger_entries
3.  Supabase broadcasts 'table:settled'
4.  All participants see the final "you owe X" screen
```

## Real-Time Architecture

```
Supabase channel: 'table:{tableId}'

Events broadcast:
  - receipt:processing    ← OCR job started
  - receipt:ready         ← items available
  - selection:added       ← participant selected an item
  - selection:removed     ← participant deselected an item
  - participant:joined    ← new person joined the table
  - table:settled         ← ledger computed, show results
```

All events are triggered by Postgres row changes (Supabase `postgres_changes` subscription) — the DB is the single source of truth. No separate event store needed.

## V1 Auth Model (No Accounts)

- Tables identified by UUID + short `share_code`
- Participant identity: `{participantId, sessionToken}` generated client-side, stored in `localStorage`
- `sessionToken` is passed as a request header for write operations
- Server validates `sessionToken` matches the `participants` row before allowing selection writes
- No JWT, no OAuth — pure ephemeral session

## V2 Auth Migration

When Supabase Auth is added:
- `participants.user_id` FK to `auth.users` becomes populated for logged-in users
- RLS policies tighten: writes require `auth.uid() = participants.user_id`
- Anonymous V1 sessions can be "claimed" by a logged-in user (link session_token → user_id)
- No schema changes needed — designed for this migration from day one
