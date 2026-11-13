# Railway UAT release — 5 November 2026

GitHub: private repository `Yadukrishnan117/legal-doc-manager-uat`. Railway project `Legal Doc Manager UAT`, environment `uat`, single application service in Singapore (`asia-southeast1-eqsg3a`), with a dedicated 500 MB volume at `/data`. Live UAT: https://legal-doc-manager-uat-uat.up.railway.app. Read the verification and account limitations below.

This is an isolated fictional-data UAT. It does not contain the local database, uploaded files, encryption key or accounts. Production remains the separate AWS Mumbai design with verified PostgreSQL/S3/KMS/ClamAV and company SSO requirements. Railway Singapore is not India hosting; never use real client, personal or contract data in this UAT.

## Runtime

`Dockerfile.uat` launches a dedicated UAT entrypoint. Railway mounts the volume as root; the entrypoint sets ownership only on the dedicated `/data` volume, then drops to uid/gid 1000 before reading the database or listening for traffic. `LDM_ENV=uat` requires an exact HTTPS origin, explicit `UAT_FICTIONAL_DATA_ONLY=1`, a private 32-byte encryption key and a separate persistent data directory. Production mode remains fail-closed and does not enable password sign-in.

UAT uses embedded PostgreSQL/PGlite with the same restricted role, forced organization RLS and migrations as the local test engine. Records and application-encrypted document objects persist on the dedicated volume across redeployments. This is a single-replica UAT deployment, not a high-availability production database. No volume backup or restore drill has been verified.

The account plan caps each Railway service at 1 GB RAM, which prevents the intended full ClamAV service. The scanner service is reserved but empty, with no image deployed. UAT therefore enforces a restrictive UTF-8 plain-text fixture policy: only TXT documents of 1–200 KB; PDF signatures, binary/control bytes and EICAR test content are rejected. The UI labels these limits. This is validation for test fixtures, not an antivirus claim. The production ClamAV requirement is unchanged.

The bootstrap creates `uat.admin` only when the UAT database has no users. Its random temporary password is supplied through private Railway variables, never committed, and requires a change within 24 hours before workspace access. Redeployment does not reset existing accounts. Bootstrap password configuration should be cleared after successful initialization. Administrators can create test users, grant department/role scope and manage credentials through the existing dashboard. No Google or CRM integration is connected in UAT.

## Source and release

The new private repository contains a sanitized snapshot of application code, migrations, tests and guides. It excludes all `.runtime` state, passwords, environment credentials, encryption keys, logs, documents, prior archives and unrelated projects/Sites history. GitHub CI runs tests and builds the UAT Dockerfile. A separate manually triggered workflow can publish a SHA-tagged UAT image to GHCR. Railway should be pinned to the reviewed source commit for this initial deployment; later automatic releases require passing checks and deliberate source updates.

Before calling this UAT live, verify the deployment is healthy, `/health/ready` succeeds, HTTPS login returns Secure/HttpOnly cookies, temporary credentials require change, unauthenticated and wrong-role requests are denied, TXT-only uploads are enforced, and source/image identities are recorded. Changes to persistent database schemas require a snapshot first. Rollback to the prior application image does not reverse a database migration.

## Status

Live deployment verified on 5 November 2026. Private repository source, all 29 tests, dependency audit, Docker build and actual container startup passed GitHub CI. The constrained container check uses 950 MiB, one CPU and no swap. Fresh initdb exceeds the account memory cap, so the image includes a migrated empty database with zero accounts, copied atomically on first start to `/data/ldm/postgres-uat-v1`. Bootstrap credentials and keys are supplied only at runtime. Existing databases are preserved on subsequent starts. Node heap and WebAssembly compilation concurrency are bounded.

Initial verified runtime commit: `a85e2e07b6802bad555db07f9bd06e32f4ac9b59`; Railway deployment `473d2cfd-db93-4f6c-924c-71c11ab3c38c` succeeded. Public readiness returned 200, auth configuration identifies UAT, anonymous `/api/me` returns 401, temporary administrator login succeeds with Secure/HttpOnly `__Host-` cookies, and workspace APIs reject access until the password changes. Full role/workflow authorization tests pass in CI; full live human acceptance testing remains to be performed. The bootstrap password variable was cleared for subsequent deployments after initialization. No local credentials or real data were transferred.

The Railway dashboard currently shows a trial with 9 days or $5 credit remaining. Continued hosting requires a suitable funded plan; this is not a guarantee of indefinite uptime. This UAT accepts fictional TXT fixtures only and is hosted in Singapore, not India. It is not approved for production or real client records.

References: [GitHub Pages limitation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Railway regions](https://docs.railway.com/deployments/regions), [Railway volume permissions](https://docs.railway.com/volumes/reference#caveats).


## Self-service administrator recovery — 13 November 2026

UAT administrators can open **Account security**, confirm their current password and generate ten recovery codes. Codes appear once and can be downloaded privately. Replacing the set invalidates all previous codes. Keep the file in a password manager, outside the workspace; a code authorizes a password reset. The operator/assistant does not enroll or retain the administrator's codes.

The login page's **Forgot password?** form accepts an account ID, one unused saved recovery code and a new password of at least 14 characters. A successful reset consumes that code atomically, clears temporary-password expiry, requires ordinary sign-in with the chosen password and revokes all sessions. Unknown, inactive, removed and non-administrator accounts cannot use this flow. Code values are random 160-bit secrets; only SHA-256 hashes bound to the user ID are stored, with organization RLS and transaction locking. Recovery and enrollment are throttled, same-origin requests are required, enrollment requires the current password plus session CSRF, and secrets never enter audit payloads. Account removal or another administrator's password reset invalidates saved codes.

This is UAT only. Production recovery stays with Google Workspace. There is no reset-by-account-name endpoint and no email delivery dependency. If both password and all recovery codes are lost, a trusted operator must verify identity and recover access.

Migration 3 adds the recovery-code hash column without altering existing records or grants. Before starting the new runtime, the UAT entrypoint makes an atomic, private copy of the closed database at `/data/ldm/backups/before-recovery-codes` on the attached volume. The old container must stop before volume handoff. This local snapshot does not replace off-platform backups or a restore drill. Production requires migration 3 through the separate migration owner.
