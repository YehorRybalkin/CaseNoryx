# CaseNoryx

**Think like a consultant. Analyze like an expert.**

CaseNoryx is a local, single-user web application that trains you to solve realistic business problems the way management consultants do: read a client brief, investigate real (synthetic) datasets, form and test hypotheses, simulate decisions, write a structured recommendation and receive an evidence-based evaluation.

All case data, calculations, charts, filters, saved progress and evaluations are functional and persisted locally. The app works fully without an AI subscription; Anthropic-powered coaching and qualitative grading are optional.

---

## Key features

| Area | What it does |
| --- | --- |
| **Dashboard** | Welcome/onboarding, continue active case, available/completed cases, average score, analytical accuracy, skill radar, score progression, completion and difficulty charts, recent activity, recommended next case — all computed from persisted activity (empty states for new users, no fabricated history). |
| **Case Library** | Five fully playable cases with search, difficulty and status filters. |
| **Case Workspace** | Six tabs: Client Brief · Data Explorer · Analytics · Hypothesis Board · Scenario Simulator · Final Recommendation. Coach available in a side panel. |
| **Data Explorer** | Dataset selector, column definitions, search, sorting, segment filters, period range, pagination, reconciling totals of the filtered rows, CSV export (formula-injection safe). |
| **Analytics** | Case-specific interactive analyses (P&L, margin, mix, cohorts, unit economics, route P&L, break-even, sensitivity, channel economics, bottleneck, OTD, cost per good unit). Filters recompute the analysis from the same datasets shown in the explorer. Every chart has a table view. |
| **Hypothesis Board** | Title, description, supporting/contradicting evidence, confidence, status (Untested / Supported / Contradicted / Inconclusive), plus investigation notes. Persisted. |
| **Scenario Simulator** | Case-specific levers, deterministic recalculation, baseline vs. scenario with deltas, declared model assumptions, saved scenarios (results recomputed server-side). Also available as a standalone page. |
| **Recommendation** | Eight structured sections, key KPI answers and driver selection; debounced autosave; explicit submission with confirmation; submitted snapshots are immutable; new attempts possible. |
| **Evaluation** | 100-point rubric (see below), objective grading against server-side answer keys, optional AI qualitative grading, strengths/weaknesses/missed insights/quantitative errors/improvements, model answer comparison. |
| **Analytics Laboratory** | React Hook Form + Zod calculators for financial, customer, marketing and operations metrics, using the same tested engine. |
| **AI Consulting Coach** | Interview / Guided / Learning modes. Claude via server-side calls when configured; otherwise deterministic, case-specific escalating hints. |
| **Performance Center** | Completed cases, submissions, score history, averages, strongest/weakest skills, improvement trend, performance by difficulty and case, links to compare submissions with model solutions. |
| **Settings** | Display name, theme (light/dark/system), default coach mode, AI toggles, AI configuration status, reset-all with typed confirmation. |

### The five cases

| # | Case | Client (fictional) | Difficulty | Core analytics |
| --- | --- | --- | --- | --- |
| 1 | Retail Profitability Crisis | Nordhaven Retail Group | Beginner | P&L bridge, margin, mix, returns, opex |
| 2 | SaaS Customer Churn | Lumora Cloud | Intermediate | Cohorts, churn, MRR movements, NRR, CAC, LTV/CAC |
| 3 | Airline Market Expansion | Aerivia Regional | Intermediate | Route P&L, contribution, break-even LF, sensitivity |
| 4 | E-commerce Marketing Strategy | Brightcart Home | Advanced | ROAS vs. break-even ROAS, contribution, incrementality |
| 5 | Manufacturing Transformation | Kestrel Components | Advanced | Bottleneck, downtime, defects, OTD, cost per good unit |

Each case contains a brief, context, problem statement, objectives, success criteria, stakeholders, KPIs, investigation questions, 5–7 datasets, scenario levers, key-calculation questions, a diagnosis option list (with distractors), declared assumptions and learning outcomes. Each **answer key** (root causes, expected calculations with tolerances, key facts, recommendation themes, value-destroying actions, alternative interpretations, common mistakes, a model recommendation and coaching hint ladders) lives in `src/server/answer-keys` and is computed from the datasets themselves, so the key can never drift from the data.

---

## Technology stack

- **Next.js 16** (App Router, server components, server actions, route handlers), **React 19**, **TypeScript (strict)**
- **Tailwind CSS 4**, shadcn/ui-style components on **Radix UI** primitives, **Lucide** icons, **Recharts**, **sonner** toasts, **next-themes**
- **React Hook Form** + **Zod 4** (client and server validation)
- **Prisma 6** + **SQLite** (local persistence)
- **@anthropic-ai/sdk** (optional; structured outputs validated with Zod; default model `claude-opus-5-5`)
- **Vitest 4** (unit + integration), **Playwright** (end-to-end), ESLint (Next config)

## Architecture

```
src/
  app/                       Routes (server components), server actions (actions.ts), API routes (/api/coach, /api/health)
  components/                Presentation: ui/ primitives, layout/, dashboard/, cases/, workspace/ (tabs), analytics/ (per case),
                             charts/, review/, coach/, lab/, settings/
  lib/
    analytics/               Pure, tested business-metric engine (financial, customer, marketing, operations, numerics)
    cases/                   Public case definitions + seeded synthetic data generators + case metrics (client-safe)
    simulation/              Deterministic scenario engines per case
    evaluation/              Report types, text/number extraction helpers
    recommendation.ts        Recommendation schema (Zod), sections, completeness rules
    performance.ts           Pure aggregation of persisted performance history
    format.ts, csv.ts        Presentation-only formatting and CSV export
  server/                    Server-only modules (import "server-only")
    answer-keys/             Hidden answer keys (never imported by client code)
    evaluation/              Deterministic grader + pipeline combining optional AI assessment
    ai/                      Anthropic client, AI evaluator, AI coach (timeouts, retries, error mapping)
    coach/                   Offline deterministic coach + concept library
    services/                Persistence layer (Prisma) and business workflows
    env.ts, db.ts            Environment validation, Prisma client
prisma/                      schema.prisma, seed.ts
tests/unit, tests/integration, e2e/
```

Key design decisions:

- **Analytics are independent of AI.** Every number in the UI and every objective grade comes from deterministic TypeScript functions; AI only adds optional qualitative commentary and scores for three rubric dimensions.
- **Synthetic data is generated deterministically** from fixed seeds (mulberry32) at module load, so the explorer, charts, simulator and grader all read the same rows. Money is summed in integer cents.
- **Answer-key separation is enforced by design and by tests:** answer keys are `server-only` modules; client components cannot import `@/server/*` (checked in `tests/unit/misc.test.ts`); the model solution reaches the browser only inside a stored evaluation report, which exists only after a submission.
- **Submissions are immutable snapshots.** Drafts are separate rows; once submitted, a case is locked until a new attempt is explicitly started.

## Evaluation rubric

| Dimension | Points | How it is graded |
| --- | --- | --- |
| Problem structuring | 15 | AI (if enabled) — otherwise *indicative* heuristics (hypotheses recorded/tested/evidenced, distinct root causes, section completeness) |
| Analytical accuracy | 25 | **Objective**: key KPI answers vs. values computed from the datasets, with numerical tolerances; half credit within 2× tolerance; unit errors (fraction vs. percent, EUR vs. EUR m) and sign slips detected |
| Root-cause diagnosis | 20 | **Objective**: driver selection vs. answer key (root/contributing/distractor; distractors penalised) + narrative must state each mechanism (entity and effect in the same sentence — not keyword lists) |
| Strategic recommendations | 20 | AI (if enabled) — otherwise *indicative* coverage of answer-key themes, prioritisation, risks, penalties for value-destroying actions |
| Quantification & evidence | 10 | **Objective**: numbers extracted with units and matched to dataset facts within tolerance; likely misquotes reported |
| Executive communication | 10 | AI (if enabled) — otherwise *indicative* checks (length, answer-first, quantified, structured) |

**Honest scoring:** without AI, the headline is the *objective score* (55 points normalised to %), and **no overall /100 score is shown**, because three dimensions were not meaningfully assessed. With AI enabled and successful, the overall score is the sum of all six dimensions; AI-assessed dimensions are labelled *AI-generated*, clamped to rubric bounds and cannot change objective grades.

---

## Getting started

Requirements: **Node.js 20+** (tested on 22) and npm.

```bash
npm install          # also runs `prisma generate`
npm run setup        # creates .env if missing, then the database + seed (profile, settings, 5 cases)
npm run dev          # http://localhost:3000
```

Production mode:

```bash
npm run build
npm run start
```

`npm run setup` works the same on Windows, macOS and Linux: it creates `.env` from `.env.example` when it is missing (no `cp` needed). If `DATABASE_URL` is not set, the app falls back to `file:./dev.db`.

The seed never creates user activity — the dashboard starts empty and fills only from your own work. All user data lives in `prisma/dev.db` and survives restarts. To start over, use **Settings → Danger zone → Reset all progress**, or delete `prisma/dev.db` and run `npm run setup` again.

### Enabling AI coaching and AI evaluation (optional)

1. Add your key to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-opus-5-5   # optional override
   AI_TIMEOUT_MS=60000               # optional
   ```
2. Restart the server. Settings will show “Configured”.
3. Toggle *AI consulting coach* and *AI qualitative evaluation* in Settings.

The key is read only on the server, never logged and never sent to the browser. AI calls use structured JSON outputs validated with Zod, request timeouts, SDK retries for transient errors, clear user-facing error messages, and the server-side refusal fallback (`server-side-fallback-2026-07-01`, `fallbacks: "default"`). Learner text is treated as untrusted data in prompts, and the AI has no ability to change grades or answer keys. If a call fails, the coach falls back to offline hints and the evaluation falls back to the limited deterministic report.

## Testing

```bash
npm run typecheck    # tsc --noEmit (strict)
npm run lint         # ESLint (next/core-web-vitals + typescript)
npm test             # Vitest: unit + integration (uses an isolated prisma/test-integration.db)
npm run test:e2e     # next build, then Playwright against a fresh prisma/e2e.db on port 3200
```

Test coverage includes: metric formulas and edge cases (zero denominators, missing data, rounding, cent-exact sums); dataset consistency and planted root-cause signals for all five cases; generator determinism; scenario baselines and lever directions; answer-key completeness and consistency; grader arithmetic, tolerances, unit-error and distractor handling; overall-score honesty rules; AI pipeline (mocked) clamping and failure fallback; offline coach behaviour; answer-key separation; CSV escaping; Prisma persistence lifecycle (drafts, locking, submission, evaluation, attempts, restart persistence, reset). E2E covers the whole journey: onboarding → case selection → data exploration/CSV → analytics filters → hypotheses → scenario save → draft autosave → submission → feedback → reopening the locked case → dashboard/performance updates → offline coach → calculators → settings/theme → mobile navigation.

Playwright uses the Chromium installed for `@playwright/test`; if you have none, run `npx playwright install chromium` once.

## Security notes

- **Local single-user mode only.** There is no authentication; do not expose the app on a network or deploy it multi-user as is.
- Server-side Zod validation on every action and API route; payload limits (server actions 256 kB, coach API 64 kB, section length caps); Prisma parameterised queries; React escaping for all user content; CSV formula-injection protection; security headers (CSP, `X-Frame-Options`, `nosniff`, referrer and permissions policies).
- Environment variables are validated (Zod) on first use; errors name the invalid variable but never print values.
- `npm audit` reports 0 known vulnerabilities at the time of writing (a transitive `deepmerge-ts` advisory in the Prisma CLI is resolved with an `overrides` entry).

## Known limitations

- Without an API key, problem structuring, strategic recommendations and executive communication are only heuristically indicated and excluded from any overall score — by design.
- The deterministic narrative checks use sentence-level concept co-occurrence and dataset-fact matching; they can miss unusual phrasings or accept a well-phrased but shallow sentence. The AI assessment mitigates this when enabled.
- AI features were implemented against the SDK's documented API and tested with mocks; they were not exercised against the live API in this build environment (no key available).
- Datasets are synthetic and simplified (e.g. monthly granularity, deterministic response curves in simulators).
- `npm run db:reset` uses `prisma db push --force-reset`; some Prisma versions refuse this when run by AI agents — deleting `prisma/dev.db` and running `npm run setup` is equivalent.

## Suggested next improvements

- Multi-user mode with authentication and per-user data isolation.
- Streaming coach responses; persisted coach conversations.
- More cases (pricing, M&A, market sizing) and case authoring tooling.
- Price/volume/mix waterfall charts and cohort heatmaps.
- Calibration of the deterministic grader against a labelled set of human-graded submissions.
