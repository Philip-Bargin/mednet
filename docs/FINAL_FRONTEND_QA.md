# MedNet final frontend quality audit (Phase 5E, 2026-10-12)

Scope: the Next.js web client in `web/`, every public and protected route, against the approved Figma
reference (https://dab-text-35201810.figma.site). This was an audit and stabilisation phase: confirmed defects
were fixed with regression tests; no features, endpoints or permissions were added. Backend code was not
changed. No PostgreSQL connection was made (the exposed Supabase password is still unrotated); real-API tests
used a throwaway H2 database. This file contains no credentials or patient data; all test data is synthetic.

This is a historical report. The authentication implementation changed afterward to MedNet-managed
sessions and EKDSend email; OAuth findings and routes below describe the earlier version.

Severity: **Critical** security exposure or major data-integrity risk · **High** essential workflow broken ·
**Medium** significant usability or functionality issue · **Low** minor visual or presentation inconsistency.

## Summary

| Measure | Result |
|---|---|
| Routes reviewed | all 69 built routes (68 pages and the 404); 74 route states × 3 widths in the sweep, plus a 320px reflow pass |
| Critical / High defects found | **0 / 0** |
| Medium defects found and fixed | 3 (dialog reopen race, 320px reflow, production record focus) |
| Low defects found and fixed | 4 groups (typography fidelity, table alignment, doctor application retry, unbranded 404) |
| Unresolved frontend defects | none known at Critical, High or Medium |
| Launch blockers | external: PostgreSQL re-verification (password rotation), Google OAuth end to end, Supabase account ownership, production CSP and proxy configuration (see §10) |

## 1. Method and coverage

1. **Baseline** (before changes): lint, typecheck and Vitest (158/158) passed; the mocked browser suite had
   passed on `next dev` in the earlier part of this phase; route inventory from `src/app` and the four
   tracking documents, the security audit and every logged deviation reviewed.
2. **Cross-route quality sweep** (`e2e/audit.spec.ts`, new): every route state below at 390, 820 and 1440px,
   API stubbed in the browser. Per page: exactly one `main` and one `h1`, a title, `lang="en"`; no horizontal
   scroll; no clipped text (an ellipsis is accepted only where the full text is exposed); every internal link
   resolves to a real route; every visible control at least 24×24 px or meeting the WCAG 2.5.8 spacing or inline
   exception; a keyboard walk through every focusable control checking a visible focus indicator, that the
   control is scrolled into view and never inside hidden or inert content; axe WCAG 2.2 A/AA. Plus empty and
   unreachable-API states for every workspace, and a 320px reflow pass (WCAG 1.4.10) for every area.
   `e2e/audit-self-test.spec.ts` plants one defect of each kind on a test page and proves the sweep reports it.
3. **Keyboard-only workflows** (`e2e/keyboard.spec.ts`, new): cancelling an appointment and backing out of a
   super-administrator suspension using only the keyboard (first focus, focus confinement, Escape, return
   focus, reopen), the account menu, and form-error focus and description linkage.
4. **Figma comparison**: side-by-side screenshots of every designed screen, and an automated comparison of the
   computed font size and weight of every text element shared by the live reference and the implementation
   (12 screens). See `DESIGN_SYSTEM.md` §22.
5. **Production build**: route gating and headers probed with `next start`; the whole mocked suite and the
   sweep re-run against the production build.
6. **Real API**: all eight live suites against a fresh H2 database through `next dev` (one worker).
7. **Code review**: browser storage, CSRF, session-expiry handling, unsafe HTML, status vocabularies.

Route states in the sweep: public (`/`, `/find-care`, provider link, `/about`, `/services`, unknown route),
account access (`/sign-in`, `/reset`, `/verify`, `/account`), patient (12), doctor (12), super administrator
(8), administrator (5), laboratory (8), home care (4), previews (15).

**Not covered** (stated, not hidden): testing with a real screen reader (NVDA, JAWS, VoiceOver) — semantics were
checked through the accessibility tree, axe and DOM assertions only; WCAG 1.4.12 text-spacing overrides; Windows
high-contrast mode; real mobile devices (browser viewports only); Google OAuth; PostgreSQL.

## 2. Page-by-page visual assessment

| Area | Reference | Assessment |
|---|---|---|
| Homepage | Designed | Layout, hero, sections and stacking match at 1440 and 390 (measured in 4B, §14.1). Fixed: header link weight and size, wordmark size. |
| Find care / provider drawer | Component only | Consistent with the design system; drawer is a labelled modal with focus handling (tested). |
| Account access | None | Interpreted on `AuthShell` (§13); consistent; no defects. |
| Patient dashboard | Designed | Structure matches; content adaptations documented (§15.2: no visit preparation, no fees, real notifications). Fixed: row title weight. |
| Patient sub-views | Template | Consistent with the template and design system. |
| Doctor dashboard | Designed | Structure matches; real counts and notifications replace unsupported cards (§16.2). Fixed: row title weight, payout value size, 320px row overflow. |
| Doctor sub-views | Template | Consistent. Fixed: record form overflow at 320px; retry on a failed application load. |
| Super administrator | Designed | Structure matches; audit trail replaces fictional security events (§17.2). Fixed: audit-event and tile title weight, 320px row overflow. |
| Administrator | Designed | Structure matches; escalations presentation-only (§17.2). |
| Laboratory | Designed | Structure matches; unsupported stages shown as unavailable (§18.2). Fixed: table cell alignment, payout values. |
| Home care | None (Phase 5C) | Consistent with the laboratory layout and design system; no defects. |
| Previews (collection provider and agent, support, finance, specimen lifecycle, permissions matrix) | Designed | Structure matches, clearly labelled fictional data, disabled actions. Fixed: title weights and sizes on six screens. |
| Not found | None | Branded 404 from the public shell (added this phase). |

## 3. Figma fidelity findings

Classification of every visual difference found (details and measurements in `DESIGN_SYSTEM.md` §22):

| Difference | Classification |
|---|---|
| Reference text at 9–12px raised to 11px eyebrows and 13px captions | Accessibility improvement (approved, §12.3) |
| Field values 16px instead of 13px | Accessibility improvement (approved, prevents mobile zoom) |
| Button labels at the 15px/700 button token where the reference draws small text links | Accessibility improvement (target size) |
| Workspace top-bar title is a 22px/600 H1 (reference 23px/400 on dashboards, 16px/700 on operations) | Approved adaptation (§12.3 item 4: H1 stays semibold) |
| Card kicker 11px (reference 12px dashboards, 10px operations) | Approved adaptation; documentation corrected |
| Sidebar "Switch workspace" select, top-bar search and inbox buttons absent | Approved functional adaptation (one role per account; no search or inbox API) |
| Fees, payouts, specimen, catalogue, escalation content | Approved functional adaptation (presentation-only with fictional-data badges, or omitted) |
| Reference defects (doctor dashboard overflow at 390px, clipped buttons, short sidebar background, low-contrast wordmark) | Fixed in earlier phases, not reproduced |
| Pages the reference does not draw (account access, About, Services, home care, profiles, 404) | Missing reference specification; built from the design system |
| Row, audit, tile and preview title weights; payout value size; lifecycle and principle title sizes; agent card sizes; header links; wordmark; table cell alignment | **Unintended implementation defects — fixed (Low)** |

## 4. Responsive defects and resolutions

| Finding | Severity | Resolution |
|---|---|---|
| At 320px (WCAG 1.4.10 reflow) the doctor's record form overflowed by 15px: a one-column grid track could not shrink below the date-time field | Medium | Track set to `minmax(0,1fr)` (`provider/patients.tsx`) |
| At 320px activity rows and the doctor's schedule rows overflowed by 2–3px: icon, badge and chevron could not fit beside the title | Medium | Rows wrap the badge and chevron onto a second, right-aligned line when the title would fall below ~7–9rem (`ui/lists.tsx`, `provider/overview.tsx`) |
| At 320px the top bar truncated its eyebrow ("Patient workspace", the date, "Current workspace") with no way to read it | Medium | Eyebrow and title wrap below 768px and truncate (with the title exposed) from 768px |
| 390, 820, 1440px | — | No horizontal scroll, clipped text or undersized target on any route state |

Sidebars, drawers and dialogs, table stacking below 768px, card stacking and footer behaviour were checked in
the screenshots and by the existing workspace specs.

## 5. Accessibility findings

| Finding | Severity | Resolution and test |
|---|---|---|
| **Dialogs could not be reopened after Escape** when the opener was activated quickly (keyboard users): the browser returns focus before the native `close` event, so the parent still thought the dialog was open and the next Enter was lost. Affects every `Dialog`, `ConfirmDialog` and `Drawer`. Intermittent (2 of 3 runs at 390px) | Medium | User dismissals (Escape, backdrop, close button) now close, return focus and notify the parent synchronously (`ui/dialog.tsx`). `keyboard.spec.ts` (repeated 3× per width, and 8/8 in an instrumented reproduction) |
| In production builds, choosing a record did not move focus to its details (development double effects hid it) | Medium | Fixed in `record-layout.tsx`; `home-care.spec.ts` "opening a request moves focus to its details…", passes against the production build |
| 320px reflow (above) | Medium | Fixed; 320px pass in `audit.spec.ts` |
| Focus never reaches content behind an open dialog; Tab past the last control may move to the browser's own toolbar, which is platform behaviour, not a trap | — | Asserted in `keyboard.spec.ts` |
| Every control on every route state has a visible focus indicator, is reachable, and is never hidden when focused | — | Sweep: no findings |
| Form errors: invalid field focused, `aria-invalid`, error text linked by `aria-describedby`; errors and failures announced (`role="alert"`), steady states not | — | `keyboard.spec.ts`, workspace specs |
| Tables: caption, `scope="col"` headers; stacked list below 768px | — | Code review, axe |
| Contrast, names, landmarks, ARIA validity | — | axe WCAG 2.2 AA on every route state and on empty and error states: 0 violations |
| Reduced motion: transitions and smooth scrolling disabled under `prefers-reduced-motion` | — | Global rule; used by the keyboard walk |

## 6. Cross-role workflow results (real API, H2)

Fresh throwaway H2 database, API on :8081 with rate limiting on and a generated local admin password, web
through `next dev` proxying `/api`, one worker, synthetic accounts created through the real endpoints. Every
suite runs at 390, 820 and 1440px.

| Suite | Workflows exercised | Result |
|---|---|---|
| `auth.live` | sign-out state, Google status, registration, email verification (valid, forged, resend), sign-in with safe redirect, account page without clinical data, sign-out, password reset by code, super-administrator landing | **30/30** |
| `find-care.live` | live directory sections, search and filters, providers with no open times, sign-in round trip keeping the chosen time, booking requires a profile, a taken time refreshes instead of double-booking, provider accounts refused | **24/24** |
| `patient.live` | profile first, booking, answering confirmations and proposed times, cancelling a pending request, record sharing and consent, messaging, laboratory and home-care requests, medications and vitals, notifications, text consultation, session ended elsewhere, provider redirected away | **33/33** |
| `provider.live` | requests reach the doctor; confirm, decline and propose with the patient's answers; text consultation; consent-gated records; messaging limited to care relationships; availability publish, overlap refusal and close; pending applicant isolation | **24/24** |
| `admin.live` | super-administrator re-sign-in; provider intake and approval; account create, verify, suspend, reactivate, edit, delete; protected deletion; administrator limits and API refusals of super-administrator actions; patient redirected; home-care assignment seen by the partner; sign-out | **27/27** |
| `laboratory.live` | patient request → administrator assignment → processing → result (invisible to the patient) → doctor return → correction → release → patient sees it; other accounts refused; administrator cannot suspend peers; sign-out removes orders | **36/36** |
| `home-care.live` | patient request → assignment (administrator sees no care details or address) → staff schedule (no patient identity) → patient sees the time → start and complete; other accounts refused; a cancelled request refused to staff | **24/24** |
| `pagination.live` | 100+ providers, results and queue rows: paging, server filters, review queue, role boundaries | **8/8** (1440px only; 16 skips by design) |

**206 passed, 0 failed.** Mocked results are reported separately in §12.

## 7. Navigation and routing findings

| Check | Result |
|---|---|
| Internal links on every route state | all resolve (the Google sign-in link targets the API's OAuth start, by design) |
| Unknown routes (`/no-such-page`, `/patient/no-such`, `/admin/nope`) | 404 with the branded page |
| Development routes (`/foundation`, `/foundation/workspace/*`) in production | 404 |
| Preview routes (`/preview/*`) in production, default configuration | 404; served only with `MEDNET_PREVIEW_WORKSPACES=enabled` |
| Protected routes without a session | data-free shell, then "Go to sign in" with a return link (existing specs); no API data rendered server-side |
| Wrong role | redirected to the role's own workspace before any data request (existing specs, every workspace) |
| Expired session | protected content removed and sign-in offered, on load and mid-action (existing specs, every workspace) |
| Unsupported operations | labelled presentation-only or unavailable; preview actions disabled (existing specs) |
| Status vocabularies | appointment (6), laboratory result (3), service request (4) and provider application (4) badge maps match the backend's database constraints exactly |
| Failed loads | every workspace shows an alert with **Try again** and no stale data (new sweep states). Fixed: the doctor workspace's application gate said "Reload the page" with no retry (Low) |

## 8. Security regression results

| Control | Result |
|---|---|
| Account-takeover fixes, rate limiting, session invalidation, idle and absolute lifetimes, CSRF, role checks, record consent, laboratory release restrictions | No backend change this phase; `mvn test` and the real-API suites re-run (results below) |
| Frontend | No `localStorage`, `sessionStorage`, IndexedDB or cookie access in client code; CSRF token fetched for every write; every workspace listens for session expiry; no `dangerouslySetInnerHTML` or `eval` |
| Security headers on the production build | `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment off); `X-Powered-By` absent |

## 9. Verified fixes

| # | Fix | Files | Regression test |
|---|---|---|---|
| 1 | Dialog reopen race | `components/ui/dialog.tsx` | `e2e/keyboard.spec.ts` |
| 2 | 320px reflow: record form, activity and schedule rows, top bar | `features/provider/patients.tsx`, `components/ui/lists.tsx`, `features/provider/overview.tsx`, `components/layout/workspace-shell.tsx` | `e2e/audit.spec.ts` (320px reflow) |
| 3 | Record focus in production builds | `features/workspace/record-layout.tsx` | `e2e/home-care.spec.ts` |
| 4 | Doctor application load retry | `features/provider/application.tsx` | `e2e/provider.spec.ts` "a failed application load can be retried in place" |
| 5 | Branded 404 page | `app/not-found.tsx` | `e2e/public.spec.ts` "an unknown address answers 404…" |
| 6 | Typography fidelity (row, audit, tile, preview titles; payout values; header; wordmark) | `components/ui/lists.tsx`, `components/layout/{public-header,wordmark}.tsx`, `features/{admin/overview,laboratory/views,preview/views,preview/components,provider/overview,provider/patients,provider/messages,patient/messages,patient/records,workspace/record-layout}.tsx` | `e2e/fidelity.spec.ts` (row and audit titles) |
| 7 | Table cells vertically centred | `components/ui/data-table.tsx` | `e2e/fidelity.spec.ts` |

## 10. Remaining known limitations

- **Not tested with a real screen reader or real devices** (see §1).
- Presentation-only screens remain by decision: patient payments, doctor earnings, laboratory specimens,
  catalogue, pricing and audit history, administrator escalations, and all `/preview/*` workspaces.
- The laboratory's assigned-order list (`GET /partner/service-requests`) is still unpaged (Phase 5D).
- Patient-initiated rescheduling is approved in principle and not built.
- Hero photograph licence and credit, and final brand-green confirmation, are open owner items.
- One development-only dependency advisory (`SECURITY_AUDIT.md`).
- Visual review of hover-only styles was by code inspection; contrast of hover states is not machine-checked.

## 11. Production launch blockers

| # | Blocker | Owner action |
|---|---|---|
| 1 | Supabase database password exposed and not rotated; **no PostgreSQL verification** since Phase 5A (workflow IT and live suites) | Rotate, confirm, then run `mvn -Ppostgres-it verify` and the live suites on a `_test` database |
| 2 | Google sign-in never run end to end | Configure a development OAuth client; keep `GOOGLE_OAUTH_ENABLED=false` until it passes |
| 3 | Ownership of the existing accounts in the Supabase `postgres` database unknown | Confirm before any write |
| 4 | Rate limits are per process; `MEDNET_TRUSTED_PROXIES` must name the production proxy | Single instance or shared state; set the proxy |
| 5 | Production CSP covers framing, base URI and objects only (no `script-src`/`connect-src`); HSTS expected from the reverse proxy | Decide the deployment's CSP and HSTS |

PostgreSQL and Google OAuth verification are **not** complete and are not marked complete here.

## 12. Automated verification (final run, 2026-10-12)

| Check | Mode | Result |
|---|---|---|
| `mvn test` | H2 | **76/76** |
| Lint, typecheck | — | pass |
| Vitest | mocks | **158/158** |
| Production build | — | pass, 69 routes |
| Full mocked Playwright suite, 390/820/1440 (axe WCAG 2.2 AA in every page spec, the sweep, its self-test, keyboard workflows) | `next dev`, 2 workers | **953 passed**, 43 skipped by design, **0 failed** |
| Mocked suite against the production build (all specs except `foundation`, `components` and `fidelity`, which use development-only `/foundation` pages) | `next start` with `MEDNET_PREVIEW_WORKSPACES=enabled` | **848 passed**, 22 skipped by design, **0 failed** |
| Default production configuration | `next start` | `/preview`, `/preview/finance`, `/foundation` answer 404; headers as in §8 |
| Real-API suites | H2 API | **206 passed, 0 failed** (§6) |
| PostgreSQL workflow IT and live suites | PostgreSQL | **not run — blocked by credential rotation** (§11) |

Skips are viewport-conditional, not disabled tests: desktop-only fidelity checks (20), the 320px reflow pass
run once from the compact project (18), the sweep self-test run once (4), and the collapsed-rail label check,
which does not apply at 1440px (1). The production run skips only the reflow and self-test duplicates (22).
