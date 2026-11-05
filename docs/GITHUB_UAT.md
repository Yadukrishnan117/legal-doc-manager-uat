# Railway UAT release — 5 November 2026

GitHub: private repository `Yadukrishnan117/legal-doc-manager-uat`. Railway project `Legal Doc Manager UAT`, environment `uat`, single application service in Singapore (`asia-southeast1-eqsg3a`), with a dedicated 500 MB volume at `/data`. URL allocated: `https://legal-doc-manager-uat-uat.up.railway.app`; a live deployment and smoke checks must be confirmed separately below.

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

Repository and Railway resources are created. Source upload, CI, application deployment and public smoke checks are in progress. No local credentials or real data were transferred.

References: [GitHub Pages limitation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Railway regions](https://docs.railway.com/deployments/regions), [Railway volume permissions](https://docs.railway.com/volumes/reference#caveats).
