# khlaas

> OCR-powered per-item bill splitting — scan a receipt, everyone selects what they ate, we do the math.

**khlaas** (خلاص) — Arabic for "done", "finished", "all settled".

## What it does

1. One person scans the restaurant bill with their phone
2. OCR reads every line item automatically
3. A shareable link is created — everyone joins on their own phone
4. Each person taps the dishes they ate (real-time, collaborative)
5. khlaas calculates exactly what each person owes, including their proportional share of tax and service charges
6. No more "let's just split it equally" when you only had a salad

## Status

Pre-development. See [RESEARCH.md](./RESEARCH.md) for the full technical literature review and stack decisions.

## Planned Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Real-time:** Supabase Realtime
- **Database:** Supabase (PostgreSQL)
- **OCR:** AWS Textract AnalyzeExpense + Claude Haiku fallback
- **Storage:** Cloudflare R2
- **Background jobs:** Inngest
- **Hosting:** Vercel

## Roadmap

| Phase | Description |
|---|---|
| V1 | Single bill split, no accounts, join by link |
| V2 | Persistent ledger across bills, user accounts |
| V3 | Long-running groups (Splitwise-style) |
| V4 | Expo mobile app (shared monorepo) |

## Development

```bash
pnpm install
pnpm dev
```

See [RESEARCH.md](./RESEARCH.md) for architecture decisions, OCR tradeoffs, and schema design.
