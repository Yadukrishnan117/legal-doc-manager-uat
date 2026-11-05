> Historical deployment notes. The new PostgreSQL/S3/ClamAV runtime is implemented in `production/`. Use [PRODUCTION_RUNTIME.md](PRODUCTION_RUNTIME.md) for current commands, configuration and remaining launch gates. The static design preview was last observed with a public audience; do not treat it as authenticated company storage.

# Deployment handoff — Google Workspace + AWS Mumbai

Confirmed decisions: product **Legal Doc Manager by 72BPM**, workspace **Charge Point**, Workspace hosted domain **chargemod.com**, AWS region **ap-south-1 (Mumbai)**. OAuth client credentials, AWS access/resources, production application hostname and ERP API contract have not been supplied. No AWS deployment or live SSO validation has occurred. Never enter secrets in chat.

## What can run now

`backend/server.ts` is a dependency-free Node.js 24.12+ TypeScript development server using built-in SQLite. `backend/schema.sql` is the idempotent initial local migration; it creates tables if absent and does not modify an existing incompatible schema. Versioned upgrade migrations are a next-stage prerequisite. Application rows and workflow/outbox updates use transactions; document bytes are AES-GCM encrypted, and uploads remain immutable by version. Google OIDC state is in process memory, so restart during sign-in requires a fresh attempt.

Only `NODE_ENV=development` may start the server, bound to loopback. No production environment variable bypass is provided. A production deployment must use reviewed new adapters/runtime wiring and remove development-password support from that build. Do not deploy this Node server as if it runs on static Sites; Cloudflare static hosting cannot execute it. The Site remains a separate owner-private design preview with fictional in-memory data and unverified India residency.

## Approved target architecture — adapters still to implement

Use containerized Node.js + TypeScript compute in private Mumbai subnets (ECS/Fargate or the company's approved equivalent) behind a TLS load balancer. Keep the runtime actor/scope/transition policies intact while replacing synchronous SQLite calls with reviewed PostgreSQL transactions and repositories. Migrate users, sessions, clients, assignments, agreements, immutable version metadata, audit, privacy requests, holds/deletion proposals, inbound receipts and outbox. Add indexes, locking/idempotent writes, per-record optimistic concurrency and versioned migrations before multi-instance operation.

Use private RDS PostgreSQL in Mumbai with encryption, security-group-only access, separate least-privilege application and migration database identities, TLS certificate verification, credential rotation and tested backups. The master bootstrap identity must not be the running app credential.

Store document bytes in private Mumbai S3 with SSE-KMS, immutable version identifiers/checksums, no public ACLs, blocked public access and TLS-only access. Authorize every download through the application; issue narrowly scoped short-lived URLs or stream after the existing policy check. Quarantine and scan uploads before they become shareable. Enforce extension/MIME/magic/size rules plus production content scanning. Key path prefixes are server-owned; do not trust a browser path or content-type as authority. Configure S3 Object Lock/legal holds where approved, and align object versions/backup retention with controlled erasure.

Use a separate worker and durable queue for transactional outbox delivery, retries/backoff, dead letters, reconciliation and operator replay. The current outbox is durable but has no delivery worker; inbound HMAC receipts are accepted pending mapping review. It does not pretend to create records from an unconfigured ERP schema. Sign the exact raw request body as HMAC-SHA256 over `<timestamp-milliseconds>.<raw-json-body>`; headers are `X-Event-Timestamp` and lowercase hex `X-Event-Signature`. The application accepts only a five-minute window and a configured source/org identity, and stores IDs/hash only. Production needs per-source rotated secrets, idempotent receipt retention and a durable processing adapter.

## Infrastructure template scope

`infra/aws-mumbai-foundation.json` is a CloudFormation review artifact. It asserts Mumbai and requires an existing approved VPC, private subnet list (two AZs) and future application security group. It describes encrypted, private Multi-AZ PostgreSQL with managed master secret, deletion protection and seven-day recovery backups; private versioned SSE-KMS S3; TLS-only bucket policy; and separate 180-day security / 30-day diagnostic log groups. KMS and data resources are retained on stack deletion; database replacement/deletion snapshots are preserved. Contract retention is not implemented as an unconditional S3 expiry rule.

The template does **not** create compute, networking/NAT/endpoints, TLS/DNS, Google secrets, application IAM roles, centralized audit shipping, scanning, CloudTrail or backup-restore automation. Log groups alone do not collect anything. CloudFormation service-side validation and cost/security review are pending; only JSON structure was locally checked. Do not run an infrastructure deployment without reviewing billable resources and the organization's change controls. No stack deployment was attempted.

Restrict compute IAM to the designated object bucket prefixes, KMS use, exact secret ARNs, appropriate queue and log streams. Keep administrators, application runtime, migrations, privacy review and security-log operators separated. No AWS keys belong in browser code or environment files committed to source. Use Secrets Manager/task roles, approved KMS policies and regional account controls. Keep operational/security logs, database backups and document copies in Mumbai unless company Legal/security explicitly approves another flow. Validate Google/vendor support/telemetry data flows separately; an AWS region setting does not prove end-to-end residency.

## Google Workspace launch checklist

Create the internal OAuth client in the approved company Google project. Set the exact HTTPS callback under the production hostname and configure the allowed hosted domain to chargemod.com. Provide client ID/secret through secret storage. Use the Google Workspace MFA/device policies approved by the company. Pre-provision each application user with organization, department and role, then link the independently verified Google subject. No automatic domain-based registration or admin grant occurs.

The local protocol code uses state, nonce, PKCE and RS256 JWKS validation, exact issuer/audience/hosted-domain/verified-email checks and explicit subject lookup. Its claim validator is unit-tested, but real Google exchange, certificate-key rotation, OAuth consent behavior and Workspace offboarding need live integration verification. Persist sign-in handshakes or use a maintained reviewed OIDC library/shared store for multiple instances; add identity-key caching with rotation/error handling. Disable development passwords in production. Do not infer authorization from the OAuth `hd` request hint or an email suffix.

## Required before real data

- Implement/test PostgreSQL/S3/scanner adapters and multi-instance session/rate-limit/queue behavior; test concurrent shares and transitions and backup restoration.
- Enforce HTTPS, secure cookies, hardened proxy/host configuration, account lifecycle, privacy rights identity verification, document scanning, retention jobs and key rotation/recovery.
- Centralize redacted append-only security/audit logging in India, classify covered CERT-In logs and preserve a rolling minimum 180 days where applicable. Current local audit has no timed purge or external tamper resistance.
- Appoint incident/security/privacy/grievance owners; approve current and phased statutory applicability, notice/terms, lawful bases, processor contracts and retention/legal-hold rules. No compliance certification is claimed.
- Confirm Legal Manager approval policy, CPP categories, hardware taxonomy, signing order, numbering and exact SLA clock/calendar/working days. The prototype retains configurable 4/7 calendar-day demo defaults; the local backend stores proposed 4/7-day metadata, without a policy editor or automatic escalation worker yet.

## Common-draft update
The local schema now also persists encrypted template versions, publication evidence and client-copy start keys/fingerprints. Migrate these tables to PostgreSQL and template/client bytes to private S3 alongside existing records. Do not substitute a published master for an existing client file. Production document generation must support company-approved formats and restricted placeholder fields, quarantine/scanning, immutable source and output checksums, and explicit final approval. Current assembly is TXT only; PDF is a reference download. In-house CRM deal.closed mapping remains pending, with manual Sales entry available.
