# MedNet Web

The Next.js app is the web client for the Spring Boot API. It contains the public product overview plus the initial authenticated account and administrator workflows. Clinical workflows and patient health records are not implemented; see `../docs/req.md` for the remaining product decisions.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Run the API separately from the project root with `mvn spring-boot:run`.

The local API runs at `http://localhost:8080`; `next.config.ts` proxies `/api/*` and `/actuator/*` to it during development. Configure the initial administrator and datasource in the root `.env` before using `/admin`. See `../docs/ADMIN_SETUP.md` for the required variables.

## Verify

```sh
npm run lint        # ESLint (next core-web-vitals + typescript)
npm run typecheck   # generates route types, then tsc --noEmit
npm test            # Vitest + Testing Library unit tests (src/**/*.test.ts[x])
npm run test:e2e    # Playwright at 390, 820 and 1440px against `next dev` on port 3100
npm run build
```

Playwright uses the installed Microsoft Edge (`PLAYWRIGHT_CHANNEL=msedge` by default) so no browser
download is needed. Set `PLAYWRIGHT_CHANNEL=chrome`, or run `npx playwright install chromium` and set it
to an empty value, on machines without Edge.

## Frontend structure

- `src/app/(public)` — public pages; the layout renders the shared header and footer.
- `src/app/(auth)` — sign-in, email verification and password reset.
- `src/app/(dev)/foundation` — development-only preview of tokens and workspace shells (404 in production).
- `src/components/layout` — `PublicHeader`, `PublicFooter`, `WorkspaceShell`, `Wordmark`.
- `src/components/ui` — design-system primitives (Phase 3).
- `src/features/<domain>` — feature code; `features/workspace/workspaces.ts` is the registry of all
  workspaces, their navigation and backend support.
- `src/lib/api` — the only place that calls `fetch` for new code: CSRF, session cookie, typed errors.
- `src/lib/fictional.ts` — convention for presentation-only data (always shown with "Fictional data").

Design tokens live in `src/app/globals.css` (`@theme`). See `../docs/DESIGN_SYSTEM.md`.

## Current routes

- `/` — overview and development status
- `/services` — proposed feature list
- `/about` — implementation approach and unresolved launch decisions
- `/sign-in` — Google sign-in entry point when OAuth is enabled
- `/account` — authenticated account session view
- `/admin` — administrator sign-in and initial workflow console
- `/patient`, `/patient/profile` — patient dashboard and profile
- `/verify`, `/reset` — email verification and password reset
- `/foundation` — development-only design foundation preview
