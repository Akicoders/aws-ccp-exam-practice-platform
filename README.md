# AWS CCP Exam Practice Platform

A static, bilingual (English/Spanish) practice platform for the **AWS Certified Cloud Practitioner (CLF-C02)** exam. Built with Next.js 15, React 19, TypeScript, Tailwind CSS 4, and sourced from `master_questions_final.csv`.

## Features

- **Timed practice sessions**: 10q/10m, 20q/20m, and 50q/60m presets with CLF-C02 domain weighting
- **Two session modes**: Study mode pauses the timer when the tab is hidden and keeps feedback available; Simulation mode keeps the timer running and records conservative browser visibility/focus signals
- **Realistic scoring**: One raw point per correct answer, all-or-nothing multi-select, inclusive 70% pass threshold
- **Domain analytics**: Per-domain accuracy breakdown, weak-area aggregation, and persistent results
- **Bilingual UI**: Static English and Spanish routes with client-side locale switching
- **Responsive design**: Light/dark theme, keyboard navigation, skip link, and `aria-live` timer
- **Quiz copy deterrence**: Quiz-only selection, copy, context-menu, and drag deterrence; this is a client-side usability measure, not cryptographic protection
- **Curated explanations**: 200+ entries with a stable fallback message for uncovered questions
- **Study resources**: Curated links to official AWS documentation, training, and community resources

### Browser Integrity Limitation

This is a browser-based practice tool. A browser cannot reliably block window or tab switching, and this application cannot prove cheating or plagiarism. Simulation mode records best-effort `visibilitychange` and focus-loss signals with timestamps and shows their count in the results; an incident is only a browser signal, not proof of misconduct. It does not auto-submit when a signal occurs.

Study mode records no integrity incidents. In Simulation mode the timer continues while the page is hidden or unfocused. Browser focus and visibility behavior varies on mobile devices, so the app does not treat viewport or orientation changes as incidents, ignores focus-loss signals on coarse-pointer devices, and may receive incomplete signals depending on the browser.

## Local Commands

```bash
# Install dependencies
npm install

# Normalize and deduplicate the CSV source
npm run normalize

# Development server
npm run dev

# TypeScript check
npm run typecheck

# Unit tests (Vitest)
npm test

# Unit tests (watch mode)
npm run test:watch

# E2E tests (Playwright)
npm run test:e2e

# Production build (static export)
npm run build

# Lint
npm run lint
```

## Question Bank Audit

`src/data/questions/index.json` contains the generated audit for `master_questions_final.csv`.
The current source contains 11,474 physical lines, including 12 blank lines, and 11,447 parsed records. Papa Parse reported 0 errors. No rows were skipped for an invalid domain, missing valid answer, or blank question, and no invalid domain, answer-token, `multiSelect`, or `times` values were found.

Normalization deduplicates by the complete normalized payload: question text, `multiSelect`, `optionA-F`, `correctAnswers`, and domain. `id` and `times` identify the representative/frequency rather than the question content. All 11,447 parsed records are retained. Text-only repeats may remain when other source fields differ; those variants are intentionally distinct under the complete payload key. This prevents the previous text-only deduplication from discarding variants that shared a question stem but had different options or answer keys. The current output has 11,447 questions with no duplicate groups or removed rows:

| Domain | Generated questions |
| --- | ---: |
| Cloud Concepts | 721 |
| Security and Compliance | 3,947 |
| Cloud Technology and Services | 5,319 |
| Billing, Pricing, and Support | 1,460 |
| **Total** | **11,447** |

All generated records contain `id`, question text, `multiSelect`, `optionA-F`, `correctAnswers`, `times`, and `domain`. `optionC` is missing in 28 source rows and `optionD` in 79; those fields are explicitly replaced with `(Option not available)`. Optional `optionE` and `optionF` blanks remain blank. No usable populated field is silently dropped. The generated metadata is the source of truth for future regeneration audits.

## Question Translation Coverage

`master_questions_final.csv` and the generated question pools contain English source content only. Reviewed Spanish question and option text is intentionally separated from generated data in `src/data/questions/translations.ts`; the companion map currently contains **0 of 11,447 questions (0%)**. The Spanish UI therefore labels the English source as an explicit fallback instead of inventing or silently machine-translating AWS content. Add translations only after human review, keyed by the generated question ID.

## Project Structure

```
├── master_questions_final.csv    # Source question bank
├── scripts/
│   └── normalize.ts              # CSV normalization & dedup
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx            # Root layout with locale chooser
│   │   ├── page.tsx              # Root locale chooser
│   │   ├── not-found.tsx         # 404 page
│   │   └── [locale]/
│   │       ├── layout.tsx        # Locale layout (header/nav/footer)
│   │       ├── page.tsx          # Home page with preset selection
│   │       ├── session/page.tsx  # Exam session page
│   │       ├── results/page.tsx  # Results page
│   │       └── resources/page.tsx # Study resources page
│   ├── components/               # Reusable components
│   ├── data/
│   │   ├── questions/            # Generated domain pools (gitignored?)
│   │   └── explanations.json     # Curated explanations
│   ├── lib/                      # Core logic
│   │   ├── browser-store.ts      # localStorage persistence
│   │   ├── quiz-engine.ts        # Sampling, scoring, session
│   │   └── timer.ts              # Timer state machine
│   └── types/
│       └── contracts.ts          # All types and constants
├── messages/
│   ├── en.json                   # English translations
│   └── es.json                   # Spanish translations
├── tests/
│   ├── unit/                     # Vitest unit tests
│   └── e2e/                      # Playwright E2E tests
├── package.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── playwright.config.ts
```

## Deployment

### Vercel

```bash
npm run build
npx vercel --prod
```

### GitHub Pages (legacy/manual)

```bash
npm run build
npx gh-pages -d out
```

### S3 + CloudFront

```bash
npm run build
aws s3 sync out/ s3://your-bucket-name/
aws cloudfront create-invalidation --distribution-id YOUR_DIST --paths "/*"
```

### Rollback

- **Vercel**: Use the Vercel dashboard to roll back to a previous deployment
- **GitHub Pages**: Revert the `gh-pages` branch to a prior commit
- **S3/CloudFront**: Restore the bucket from a prior version or redeploy the previous artifact and invalidate the CloudFront cache

## Architecture Notes

- `output: "export"` produces a fully static site. No Node.js server is required.
- All routes are statically generated at build time (`generateStaticParams` for `en`/`es`).
- Session state is stored in `localStorage` under key `aws-ccp-exam:v1` as one JSON-serializable object.
- The timer starts on the first answer. Study mode pauses when the tab is hidden, has a finite 2x wall-clock cap, and persists visible elapsed time; Simulation mode uses wall-clock elapsed time while hidden or unfocused.
- Active session IDs, mode, answers, current question, timer state, and simulation incident timestamps are serialized together so locale changes do not restart an exam.
- Question IDs are unique within a session but reused across sessions.
- Domain pool sizes are generated from the deduped output — no hardcoded totals.
- No GitHub Actions, CI workflows, runtime middleware, or dynamic `[id]` routes.

### Public Static Content

This deployment model intentionally publishes the generated question bank and its `correctAnswers` fields to the browser. Anyone who can load the static site can inspect the questions, answer keys, explanations, and other shipped assets through browser tools or downloaded files. Treat this as public educational content, not private or confidential material. Do not include secrets or sensitive data in the question source or generated assets.

## Unofficial Disclaimer

This is an **unofficial** practice tool. It does NOT represent the official AWS Certified Cloud Practitioner exam. The AWS Certified Cloud Practitioner exam requires a scaled score of 700/1000. This tool uses a simplified 70% threshold for practice purposes only.

## Usage

Unofficial educational practice tool. Review the public-content warning above before deploying it.
