# MedNet Frontend Implementation Plan

Design authority: https://dab-text-35201810.figma.site (see `DESIGN_SYSTEM.md`, `PAGE_INVENTORY.md`).
Backend contract: `/api/v1` (see `FRONTEND_API_HANDOFF.md`).

**Status: Phases 1–3 approved (2026-10-10). Phase 4 (4A–4G) approved (2026-10-11). Phase 5A (PostgreSQL integration) approved. Phase 5B (offline audit and security closure) approved. Phase 5C (home-care workspace) approved. Phase 5D (performance, pagination, cleanup) complete, awaiting review; PostgreSQL checks and Google OAuth end to end remain blocked; see `FRONTEND_PROGRESS.md` and `SECURITY_AUDIT.md`.**

## 1. Codebase assessment (Phase 1, updated)

| Area | Finding |
|---|---|
| Stack | Next.js 16.3.8 (App Router, Turbopack), React 19.2.8, TypeScript 5, Tailwind CSS 4, ESLint 9. Kept unchanged. |
| Added in Phase 2 | `lucide-react` (runtime). Dev: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/{react,dom,jest-dom,user-event}`, `@playwright/test`. `@types/node` raised from 20 to 24 to match the Node 24 runtime (Vitest peer requirement). |
| Baseline before changes | `npm ci` OK; `npm run lint` passed with no findings; `npm run build` passed (11 routes). `npm audit`: 0 production vulnerabilities, 5 high in dev-only dependencies (pre-existing). |
| Styling | Legacy global classes (pre-reference) remain for pages not yet rebuilt, now layered below token utilities and re-pointed at approved tokens. |
| API access | New code uses `src/lib/api`. Account access (sign-in, verify, reset, account) migrated in 4A. Patient pages migrated in 4C. Provider pages added in 4D; administration rebuilt on `src/lib/api` in 4E (`admin-portal.tsx` deleted). |
| Auth | Cookie session + CSRF, Google sign-in, email verification, password reset, admin session. Contracts unchanged; UI rebuilt in 4A and verified against a running API. |

## 2. Architecture (as implemented)

```text
web/src/
├── app/
│   ├── layout.tsx            root: Source Sans 3 (next/font), globals.css
│   ├── globals.css           @theme design tokens + layered legacy styles
│   ├── (public)/             layout: PublicHeader + PublicFooter → /, /find-care, /about, /services (4B)
│   ├── (auth)/               /sign-in, /verify, /reset, /account — AuthShell + features/auth (4A)
│   ├── (dev)/foundation/     dev-only token + shell preview (404 in production)
│   ├── patient/ provider/ admin/   workspace layouts → features/patient, provider, admin (4C–4E)
├── components/
│   ├── layout/               PublicHeader, PublicFooter, public-nav, WorkspaceShell, Wordmark
│   ├── ui/                   design-system primitives (Phase 3: buttons, fields, badges, alerts, cards, tables, overlays, states…)
│   ├── healthcare/           domain components: doctor/appointment cards, records, status badges, timelines
│   └── workspace/            workspace compositions: WelcomeBand, PermissionBoundary
├── features/
│   └── workspace/            workspaces.ts — registry of the 9 designed workspaces, nav, backend support
└── lib/
    ├── api/                  client.ts (CSRF, session cookie, JSON, 204), errors.ts (ApiRequestError), session.ts
    ├── fictional.ts          presentation-only data convention
    └── cn.ts                 class-name join
web/e2e/                      Playwright specs (390 / 820 / 1440px projects)
```

Conventions:

- **Routes** use backend domain names (`/provider`, `/laboratory`). URLs come from the workspace
  registry; no page links to a route that does not exist.
- **Server vs client:** pages and layouts are server components. Interactive pieces (`PublicHeader`,
  `WorkspaceShell`) are client components. Icon components cannot cross the server-to-client boundary,
  so client components receive a `workspaceId` and read the registry themselves.
- **Data access:** `apiRequest<T>(path, { method, body, query })` returns parsed JSON or throws
  `ApiRequestError` (`status`, `code`, `details[]`, `requestId`, `isUnauthenticated`, `isForbidden`,
  `isNetworkFailure`). Writes always fetch a fresh CSRF token first, the same as the existing pages.
  `getSession()` returns `null` on 401. No global store; React state per feature until a real need appears.
- **Authorization:** `homePathForRole` mirrors the backend's existing redirects exactly. Frontend
  gating is for clarity only; the backend enforces every request.
- **Presentation-only screens** follow `DESIGN_SYSTEM.md` §11 (fictional data plus a visible badge, no
  invented endpoints).
- **Styling:** token utilities only (`bg-action`, `text-text-secondary`, `rounded-md`). No raw hex values
  in components. Legacy classes are not extended.
- **Tests:** unit tests next to the code (`*.test.ts[x]`); browser checks in `web/e2e`.

## 3. Decisions (approved 2026-10-10)

1. **Payments and financial UI:** keep every design. No payment collection or payment-gated flow.
   Presentation-only with labelled fictional data until the backend is approved.
2. **Collection provider, Collection agent, Customer support, Financial officer:** kept in the roadmap
   and registered as workspaces with `backendRole: null`. Built from shared components as
   presentation-only. No invented permissions or endpoints.
3. **Laboratory and specimen workflows:** the full design is preserved. Existing partner endpoints are
   integrated, and missing capabilities are listed in `FRONTEND_PROGRESS.md`.
4. **Design system:** reference is the authority; 768/1200/1440 breakpoints; 8/12px radii; current brand
   green; Lucide icons at 1.8px; provisional self-hosted hero image; reference defects fixed.
5. **Pages without full designs:** styled from reference tokens and patterns, with interpretations
   documented.
6. **Testing:** Vitest and Playwright approved and configured.

## 4. Phased roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 Discovery | Audit, inventory, tokens, plan | ✅ approved |
| 2 Foundation | Tokens, fonts, layouts, route groups, API client, workspace registry, test tooling | ✅ approved |
| 3 Components | `components/ui`, `healthcare`, `workspace` with states; `/foundation` showcase; unit, browser, fidelity, axe tests | ✅ approved |
| 4A Account access | Sign-in, register, verify, reset, `/account` on `AuthShell` + `lib/api`; contracts unchanged; live-API browser tests | ✅ approved |
| 4B Public | Homepage to reference with live directory data; `/find-care` discovery + appointment requests over `/providers`, `/appointments`; About, Services | ✅ approved |
| 4C Patient | `/patient/*` in `WorkspaceShell`: overview, appointments, records, laboratory, profile; payments presentation-only | ✅ approved |
| 4D Doctor/provider | `/provider/*`: overview, schedule, appointments, consultations, patients (consent-gated), clinical work, messages, profile; earnings presentation-only; `PROVIDER` → `/provider`; additive `AppointmentDetails` fields | ✅ approved |
| 4E Administration | `/admin/*`: role-aware super-administrator and administrator workspaces in `WorkspaceShell`, legacy parity plus appointments and service-request queues; super-admin login fix; Google `PROVIDER → /provider`; applicant link | ✅ approved |
| 4F Laboratory | `/laboratory/*`: overview, orders (start, submit result for doctor review), results, profile; specimens, catalogue, pricing, audit presentation-only; `LABORATORY` → `/laboratory`; admin status restriction and `assignedStaffPublicId` | ✅ approved |
| 4G Presentation-only operations | `/preview/*` (prod-gated): collection provider/agent, support, finance, specimen lifecycle, permissions matrix; laboratory result read-back; Google `LABORATORY → /laboratory`; final integration review | ✅ approved |
| 5A PostgreSQL integration | Root-cause the rejected local credentials; isolated `_test` databases with a guarded reset; full workflow suite and live-API specs on PostgreSQL; `docs/POSTGRESQL_SETUP.md` | ✅ approved (Supabase PostgreSQL 17.6: workflow IT 28/28, live suites 174/174) |
| 5B Security audit | Authentication, authorization, web security, dependency audit, preview gating; narrowly scoped fixes with tests; `docs/SECURITY_AUDIT.md` | ✅ offline audit approved |
| 5B Security closure | Authentication rate limiting, session lifetime and sign-out on account changes, OAuth requirements, security-control matrix | ✅ offline work approved; PostgreSQL re-runs (credential rotation) and Google OAuth end to end (no client) still blocked |
| 5C Home-care workspace | `/home-care` (overview, visits, help, profile) on the existing partner endpoints; `HOME_CARE` → `/home-care`; cross-workspace lifecycle tests | ✅ approved (mocked and H2-backed; PostgreSQL outstanding) |
| 5D Performance and cleanup | Measured baseline; server paging for capped lists; provider-wide review queue; directory next-open times, single provider and specialty counts; legacy CSS removed with computed-style verification | ✅ approved 2026-10-12 (H2 and mocks; PostgreSQL blocked) |
| 5E Final quality audit | Figma fidelity (screenshots + computed-style comparison of every designed screen), responsive and accessibility sweep of every route (`e2e/audit.spec.ts`), keyboard-only workflows (`e2e/keyboard.spec.ts`), route gating on a production build, cross-role regression on H2; defects fixed with tests; `docs/FINAL_FRONTEND_QA.md` | 🟡 complete, awaiting review; PostgreSQL and Google OAuth still blocked |
| 5 Responsive/a11y | Full 390/820/1440 and keyboard/contrast/zoom pass | covered by 5E (390/820/1440 sweep plus a 320px reflow pass, WCAG 1.4.10; see `FINAL_FRONTEND_QA.md`) |
| 6 Integration | Remaining endpoints, validation, error mapping | |
| 7 QA | Visual comparison against the reference, regression suite | covered by 5E |
| 8 Handover | Docs, known issues | |

## 5. Phase 2 checklist

1. [x] Decisions on payments, roles, and design-system conflicts recorded (§3).
2. [x] `npm ci`; baseline lint and build recorded before any change.
3. [x] Next 16 docs read: route groups, layouts (`LayoutProps`/`PageProps`), fonts, Vitest, Playwright.
4. [x] Source Sans 3 via `next/font/google` replaces DM Sans and DM Serif Display.
5. [x] Reference tokens in `@theme` (colour, semantic aliases, type scale, radii, shadows, breakpoints,
       container and sidebar widths) and global focus and reduced-motion rules.
6. [x] `lib/api` client with tests. Migration of existing fetches deferred to Phase 4, page by page,
       so auth and admin behaviour is not touched (deliberate change from the Phase 1 plan).
7. [x] Route groups `(public)` and `(auth)`, plus `(dev)` preview; all URLs unchanged.
       `patient/`, `provider/` and `admin/` workspace layouts arrive with their pages in Phase 4.
8. [x] `PublicHeader`, `PublicFooter`, `WorkspaceShell` (sidebar-height defect fixed, 820px rail).
9. [x] Vitest + Testing Library + Playwright configured with tests.
10. [x] Lint, typecheck, unit, e2e and build run; docs updated.

## 6. Phase 3 checklist

1. [x] Button (primary, secondary, tertiary, destructive, inverse; md/sm; loading and disabled; wraps, no clipping).
2. [x] Icon button, link-button, segmented control.
3. [x] Fields: text, search, select, textarea, checkbox, radio group, switch, with linked labels, descriptions
       and errors. Document upload deferred (no upload API decision).
4. [x] Badge (text + dot) and Alert (information, warning, critical, success/protected).
5. [x] Card, card header, section heading, metric card, queue/activity rows, audit event, description list,
       restricted notice, avatar.
6. [x] Data table (stacked below 768px), filter bar, pagination, underline tabs, breadcrumb, stepper.
7. [x] Dialog, confirmation dialog, drawer (native `<dialog>`), action menu, toast, info tooltip.
8. [x] States: loading (spinner, skeleton), empty, error with retry, success, permission denied.
9. [x] Healthcare: doctor card, appointment card and summary, medical record list, patient summary,
       backend-aligned status badges, specimen/processing timeline, welcome band, permission boundary.
       Date/time selectors move to Phase 4B with the booking flow.
10. [x] `/foundation` showcase; unit tests; Playwright behaviour, layout, fidelity and axe checks at
        390/820/1440; docs.

## 7. Phase 4 work packages

Order as authorised on 2026-10-10: 4A → 4G, one package at a time, each stopped for review.

1. **4A Account access (done):** see `FRONTEND_PROGRESS.md`. The provider sign-in destination is
   unchanged (`/account`); it is reviewed in 4D.
2. **4B Public website:** homepage body, About, Services; discovery and the date/time selector against
   `/providers` and `/providers/{id}/availability`.
3. **4C Patient workspace:** move `/patient` into `WorkspaceShell` and add a `patient/layout.tsx` session
   guard (UX only). Overview from live `/appointments`, `/lab-requests`, `/home-care-requests` and
   `/notifications`. Records and profile follow. Payments are presentation-only.
4. **4D Doctor/provider workspace:** inspect the redirect contracts first. Adding `PROVIDER` to
   `homePathForRole` changes the post-sign-in destination (the backend's Google success handler sends
   providers to `/account` too), so it needs both sides changed together and explicit approval.
5. **4E Administration:** split `admin-portal.tsx` into the Super administrator and Administrator
   workspaces with feature parity before any new UI. **Done** — see `FRONTEND_PROGRESS.md` Phase 4E log.
6. **4F Laboratory** — **done** (`/laboratory/*`, live laboratory → doctor → patient workflow, admin status
   restriction, `assignedStaffPublicId`); then **4G** presentation-only operations workspaces — **done**
   (`/preview/*`, off in production unless `MEDNET_PREVIEW_WORKSPACES=enabled`).
