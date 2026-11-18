# GitHub-hosted private UAT

Open this repository in GitHub Codespaces to run the full application. [UAT setup and access](docs/CODESPACES_UAT.md) explains automatic startup and the private login file. Railway is paused; its old URL is unavailable.

# Legal Doc Manager by 72BPM

ChargeMOD's legal operations application. The new authenticated runtime is in `production/`; the static Sites URL is a separate fictional design demo and must never hold company records. Its last observed audience was public. No production deployment or real Google sign-in has been verified.

## Start the application

Use Node.js 24.12+. Run `npm ci`, then `NODE_ENV=development DEV_PASSWORD_LOGIN=1 npm start`. The application opens at **http://127.0.0.1:8788** with the new login page. Accounts are not automatically seeded. One temporary local administrator was explicitly provisioned at your request; its credentials are delivered separately and are excluded from source. Initial accounts on another installation require trusted provisioning through `NODE_ENV=development npm run user:production`, using protected stdin. See [the runtime and deployment guide](docs/PRODUCTION_RUNTIME.md) for account fields and full setup.

The development runtime uses embedded PostgreSQL and encrypted private local files; use fictional data. Production requires verified TLS PostgreSQL, private Mumbai S3/KMS, ClamAV and Google Workspace configuration. Password sign-in is disabled in production. Staff permissions come from provisioned identity, role, department and record assignment; there is no role picker or public registration.

## Implemented

- Login-led interface, role-specific Legal/Sales/Operations queues, common draft library, clients, approvals, execution, administrator user/credential management and scoped audit/privacy requests.
- PostgreSQL migration, forced organization RLS, separate runtime/migration identities, database transactions, row locking, revision conflict protection and sequence-based numbering.
- Server-owned authorization on every operation and download. Administrators do not automatically see agreements. Single-department users open directly into their permitted department.
- Signed Google OIDC tokens, PKCE, nonce/state, durable encrypted handshakes, explicitly linked subjects, revocable cookie sessions, idle/absolute expiry, CSRF, host/origin checks and durable rate limits.
- Private encrypted local objects for development; production S3/KMS adapter with startup bucket checks, authenticated downloads, immutable random object references and scan-before-accept ClamAV integration.
- Legal-published common drafts become separate pinned client copies. Client changes go back to Legal; exact-version confirmation and manager approval precede Operations release and physical execution. TXT generation/PDF reference downloads only.

Run `npm run test:all` for the legacy and new security suites. Tests use isolated fictional fixtures, embedded PostgreSQL and local protocol servers; they do not verify real AWS IAM, RDS connectivity or Google configuration. Docker and CI definitions are included but have not been executed on a cloud runner here.

## Production handoff

[PRODUCTION_RUNTIME.md](docs/PRODUCTION_RUNTIME.md) is the current deployment guide. The older [DEPLOYMENT.md](docs/DEPLOYMENT.md) records historical infrastructure decisions. Real company SSO, AWS provisioning, staging validation, backup restore, monitoring, incident handling and approved India privacy/retention policies remain launch requirements. No compliance certification is claimed. CRM, client email and e-signature connections are not active.

The previous SQLite server and its tests are preserved in `backend/`; start it through `npm run start:legacy` with explicit development mode and its own original setup. It uses port 8787. No legacy-to-PostgreSQL data migration is included.

## Common draft workflow (29 October 2026)

Legal maintains **Common drafts**, uploads versions and explicitly publishes the master Sales may use. A closed lead can then start directly from a published master: Sales enters/checks the client, original lead date, closure evidence and commercial terms, and prepares a separate versioned client copy. Initial standard drafting no longer waits for a fresh per-lead Legal request. Custom agreements/client changes still go to Legal; client confirmation, internal approval, Operations release and Legal closure remain separate gates.

New local API routes: GET/POST `/api/templates`; POST `/api/templates/:id/versions`, `/publish`, `/start`; GET `/api/templates/:id/download` (optional version for authorized archives). Legal staff may edit masters; only Legal Manager publishes/withdraws. Sales sees only active published masters in its granted departments. Self-service TXT assembly and PDF reference downloads are supported; automatic PDF/Word assembly is not configured. Existing client agreements never change when a common master changes. See `docs/WORKFLOW_REDESIGN.md`.

The redesign uses distinct Legal/Sales/Operations workspaces, a common library, one current owner and next action, expandable commercial/history sections, and a future in-house CRM handoff. No actual CRM or client-email connection has been made.

## Administrator dashboard

People & access supports creating/editing users, department and role grants, local temporary-password resets, verified Google identity linking, session revocation and reversible removal/restoration. [User management guide](docs/USER_MANAGEMENT.md). Local temporary passwords expire after 24 hours and require a change before workspace access. Production remains Google Workspace SSO only.
