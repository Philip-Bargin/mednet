# MedNet Authentication Setup

MedNet uses its Spring Boot API for account registration, password sign-in, session management,
email verification, and password recovery. The API stores account credentials and issues
HTTP-only session cookies protected by CSRF tokens. External identity-provider sessions are not
part of the authentication flow.

## Runtime configuration

Set these values in the MedNet API environment. Never put secrets in Git or frontend variables.

| Variable | Purpose |
| --- | --- |
| `MEDNET_ADMIN_EMAIL` | Initial administrator account email |
| `MEDNET_ADMIN_PASSWORD` | Initial administrator password; keep server-side |
| `MEDNET_PUBLIC_URL` | Public MedNet origin used to build verification and reset links |
| `EKDSEND_API_URL` | EKDSend API base URL; defaults to `https://es.ekddigital.com/api/v1` |
| `EKDSEND_API_KEY` | Server-only key used to send authentication emails |
| `FROM_EMAIL` | Approved sender address; defaults to `support@ekddigital.com` |
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | PostgreSQL application user |
| `SPRING_DATASOURCE_PASSWORD` | PostgreSQL application password; keep server-side |

The root `.env.example` contains placeholders suitable for local development. Production values
belong in the API service's protected deployment environment.

## Account and email flow

1. The browser calls the MedNet API to register or request a verification/password-reset message.
2. The API generates a short-lived six-digit code and a separate single-use fallback link token.
3. The API sends the branded message directly to EKDSend using `EKDSEND_API_KEY`; no external
   identity provider generates codes or sends authentication messages.
4. The user enters the code in MedNet, or follows the fallback link. Password recovery verifies
   the code and issues a short-lived reset ticket before accepting a new password.

Registration and resend use privacy-preserving responses. EKDSend accepting or queueing a message
does not prove final inbox delivery. If a message is missing, inspect the specific recipient's
delivery, bounce, suppression, or defer events in EKDSend and the receiving mail provider; also
check spam/quarantine and confirm that `FROM_EMAIL` is approved. MedNet logs provider status and
message identifiers for correlation, not recipients or message contents.

## Sessions and account access

The web client authenticates using same-origin `/api/v1/...` requests and an HTTP-only MedNet
session cookie. It does not store session credentials in browser storage. State-changing requests
obtain a CSRF token from `GET /api/v1/auth/csrf` and send it with the header named in the response.
Account roles and statuses come from the MedNet database and are never accepted from browser input.

Existing users must have a corresponding MedNet account and a usable local password to sign in.
Before deploying a change from another identity provider, verify that every required account has
been provisioned in MedNet and has a password/recovery path; this code change does not migrate
external identities or passwords.
