# Supabase Auth and EKDSend Setup

MedNet uses Supabase Auth for email/password and Google identity. The MedNet API requests
single-use verification and recovery tokens from Supabase Auth Admin, then sends the email itself
through EKDSend's API. Supabase does not deliver MedNet's authentication emails: no Supabase Send
Email Hook, Edge Function, or Supabase SMTP configuration is used. The Spring API validates
Supabase access-token signatures and remains authoritative for MedNet roles, account status, and
clinical-data authorization. Supabase user metadata never grants MedNet roles.

## 1. Configure runtime variables

Set these in the MedNet project environment. Never put secret values in Git or a `NEXT_PUBLIC_*`
variable.

| Variable | Service | Purpose |
| --- | --- | --- |
| `SUPABASE_AUTH_ENABLED=true` | API | Enables Supabase JWT auth and disables legacy Spring login |
| `SUPABASE_URL` | API | Supabase project URL; `SUPERBASE_PROJECT_URL` is accepted as a legacy alias |
| `SUPABASE_SECRET_KEY` | API only | Server-only Admin key for token generation, email-confirmation checks, and rolling migration |
| `SUPABASE_ISSUER_URI` | API, optional | Defaults to `${SUPABASE_URL}/auth/v1` |
| `SUPABASE_JWK_SET_URI` | API, optional | Defaults to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` |
| `NEXT_PUBLIC_SUPABASE_URL` | Web build | Supabase project URL; legacy `SUPERBASE_PROJECT_URL` is accepted |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web build | Publishable key; legacy `SUPERBASE_PUBLISHABLE_KEY` accepted only if publishable/anon |
| `EKDSEND_API_URL` | API | EKDSend API base; defaults to `https://es.ekddigital.com/api/v1` |
| `EKDSEND_API_KEY` | API only | Server-only key used to send auth messages directly through EKDSend |
| `FROM_EMAIL` | API | Verified sender address; defaults to `support@ekddigital.com` |
| `NEXTAUTH_URL` | API | Public MedNet web origin used to construct verification/recovery callback links |

The Next.js configuration rejects Supabase secret/service-role keys rather than embedding them
in browser code. Although LPAD makes project variables available to grouped services, the
server-only Admin and EKDSend keys are not public variables and MedNet does not bundle them.

`MEDNET_ADMIN_EMAIL` and `MEDNET_ADMIN_PASSWORD` remain the bootstrap/legacy migration
credentials. Store both as server-side secrets.

## 2. Configure Supabase Auth

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the public MedNet web origin.
- Add `https://<mednet-web-domain>/auth/callback` to the redirect URL allowlist.
- For local development, also add `http://localhost:3000/auth/callback`.
- Keep the Email provider enabled and email confirmation required. MedNet sends confirmation
  messages itself; do not configure an Auth Send Email Hook for this integration.

In **Authentication → Providers → Google**:

- Enable Google and enter the Google OAuth web client ID and client secret.
- Register the exact Supabase callback URI shown in the provider settings in Google Cloud. It is
  normally `https://<project-ref>.supabase.co/auth/v1/callback`.
- Do not use the old Spring callback `/api/v1/auth/oauth2/callback/google`. Google returns to
  Supabase, then Supabase redirects to MedNet `/auth/callback`.
- Ensure Google returns a verified email. Supabase links a verified matching email to an existing
  password user automatically; MedNet still checks the account's role and status.

Manual identity linking is not required for normal password-to-Google linking. The Supabase
manual-linking feature is beta and is not part of bulk migration.

## 3. Direct EKDSend authentication email delivery

There is no Supabase mail hook or edge deployment. For registration, verification resend, and
password recovery:

1. The browser calls the MedNet API.
2. The API uses its server-only `SUPABASE_SECRET_KEY` to call Supabase Auth Admin
   `generate_link`. Supabase returns a single-use hashed token and one-time code; it does not send
   the email.
3. The API constructs a MedNet `/auth/callback` URL and sends the link and code directly to
   EKDSend `/api/v1/send` using `EKDSEND_API_KEY`.
4. EKDSend acceptance is checked. The API returns an error if email delivery was not accepted.

Authentication emails present the six-digit code as the primary verification method and include a
single-use link as an alternate. The `/verify` page accepts the code, and the link is handled by
the verifier for the active auth mode. The API rejects an incomplete Supabase response instead of
sending a link-only email when the six-digit code is missing.

When `SUPABASE_AUTH_ENABLED` is false, MedNet uses its database-backed auth controller instead:
Flyway migration `V17` stores the verification-code hash and expiry alongside the fallback-link
token, and `/verification-mode` tells the page which verifier to use. Registration and password
recovery use the same branded, code-first email template in either mode.

Keep `EKDSEND_API_KEY` and `SUPABASE_SECRET_KEY` in the MedNet API environment only. Do not add
either key to Supabase Edge Function secrets, a `NEXT_PUBLIC_*` variable, or source control. A
queued message confirms provider acceptance, not final inbox delivery. If a message appears as
sent in EKDSend but is missing from the mailbox, inspect the individual recipient/message event
(distinguishing accepted or sent from delivered, deferred, bounced, or suppressed where those
events are available), confirm the exact recipient address, and check spam or quarantine. Also
verify that `FROM_EMAIL` is an approved sender and that its sending domain's SPF/DKIM configuration
is valid. MedNet logs the EKDSend message ID and response status for correlating an auth request
with the provider dashboard; it does not log the recipient or message contents.

SPF must authorize the exact envelope-sender domain used by the MedNet message. A policy published
only at `ekddigital.com` does not apply to `mednet.lpad.ekddigital.com`; publish and verify an SPF
record at the actual sender domain, authorizing only the outbound mail infrastructure in use.
Likewise, confirm that the DKIM selector in the message's `DKIM-Signature` resolves to the public
key matching the signing server's private key. A DKIM TXT record existing in DNS is not by itself
proof that signatures validate.

## 4. Existing account migration

The rollout is intentionally rolling and non-destructive:

1. A user first tries email/password against Supabase.
2. If Supabase reports invalid credentials, MedNet checks the existing account's BCrypt hash,
   active status, and verified-email state.
3. Only after those checks pass does the API import the BCrypt password hash to Supabase. The
   submitted password is used only to complete sign-in and is not logged.
4. The existing `platform_accounts` row, MedNet UUID, public ID, role, status, and connected
   records are retained. A Supabase user ID is added to the row; authorization still comes from
   the database on every API request.
5. A previously verified but dormant user can request password recovery. The API imports that
   user's existing BCrypt hash if needed, asks Supabase Auth Admin to generate a recovery token,
   then sends the link and code itself through EKDSend. Unknown addresses receive the same public
   response.
6. Google sign-in creates/links a Supabase identity; the API links it to the existing MedNet row
   only after Supabase confirms the email.

Legacy verification/reset tokens are not used after the new flow is enabled. Suspended accounts
remain blocked, and roles are not taken from browser-controlled metadata. The legacy password
hash is retained in MedNet for rollback; do not delete or export account rows as part of cutover.

## 5. Validate before enabling for production

Use a non-production Supabase project and test:

- New signup, EKDSend delivery, confirmation link, and verification resend.
- Email/password login, backend role routing, and a valid old-password migration.
- Forgot password by callback link and one-time code.
- Google login for an existing verified account and a new patient account.
- Suspended-account denial and role preservation for `ADMIN`, `SUPER_ADMIN`, `PROVIDER`,
  `LABORATORY`, and `HOME_CARE`.
- Invalid/expired JWT rejection and missing Admin key startup/configuration errors.

Only enable `SUPABASE_AUTH_ENABLED=true` after both deployed services have their required
variables. The API validates the issuer, JWK signature, and `authenticated` audience; never accept
an ID token or a user-metadata role in place of the access token. Rotate any database credential
that has previously been exposed before connecting to a real database.

## References

- [Supabase Auth Admin `generateLink`](https://supabase.com/docs/reference/javascript/auth-admin-generatelink)
- [Supabase SSR client for Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase JWT claims](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase migration from Auth0](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0)
