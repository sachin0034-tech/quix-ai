# Claude Certification Practice Quiz: design and product notes

Visual language is unchanged from the original build. The old Inter/navy-`#002862` spec in this file was stale and has been replaced by what the code actually uses.

## 1. Tokens (see `src/app/globals.css`)

- **Font:** Golos Text (`next/font/google`, 400–800). Headings use `--font-manrope` (alias of Golos), tracking −0.035em.
- **Brand:** hero navy `#071b39` (also the body text colour, `--ink`), `--navy #04275E`, accent orange `#ff9b50` / `--accent #FEB47A`, link blue `#214f91`.
- **Surfaces:** sections below the hero alternate `#FFFFFF` and `#F4F6F9`.
- **Feedback:** correct `#15803D` on `#EAF7EF`, incorrect `#B91C1C` on `#FDECEC`. Always paired with a glyph (✓ / ✗) and text, and AA-contrast against both backgrounds.
- **Hero H1:** "Claude Certification Practice Quiz", `clamp(32px, 4.2vw, 56px)`.
- **Disclaimer:** a persistent banner on every page: "Independent practice resource. Not affiliated with or endorsed by Anthropic."

## 2. Routes

| Route | Purpose |
|---|---|
| `/` | Hero, two-track picker, outcomes, steps, call CTA, FAQ |
| `/associate`, `/developer` | Track page: readiness card + five open modules + domain weights |
| `/quiz/[attemptId]` | One question at a time, timer, instant red/green + explanation, tutor |
| `/results/[attemptId]` | Readiness /1000, domains, weakest domain, fail report, study plan, PDF, booking |
| `/report/[id]` | Private advisor view of a stored report (linked from the booking) |
| `/privacy` | Draft privacy page (needs legal review) |
| `/admin/*` | Analytics, leads, calls, reported questions (+ legacy module/question editors) |

## 3. Modules

Diagnostic (20 q, 40 min) · Quick sprint (10, 20 min, adaptive) · Domain drill (20, 40 min, adaptive) · Full mock (60 Associate / 53 Developer, 120 min, official weights, never adaptive) · Review mistakes (untimed).

## 4. Rules that must keep holding

- Answer keys and explanations never reach the browser before the learner has answered (`/api/check`). Options are shuffled per attempt (seeded).
- Scores are recomputed on the server from raw answers (`/api/results`).
- Multiple-response items are all-or-nothing and state "Select N".
- The readiness number is always labelled an estimate; "ready" = 800+ on two full mocks in a row. Never write "guaranteed pass".
- Email is asked once, after the first answered question; skippable twice, then required.
- The tutor never changes the answer key and never claims knowledge of the live exam.
