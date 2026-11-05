# Access-control contract — implemented locally

Every API is authenticated except loopback password sign-in, Google OAuth protocol endpoints and the separately authenticated integration ingress. The server derives user, organization, roles and departments from an active provisioned user referenced by a hashed opaque session. Request `role`, `requester`, `org` or `stage` fields cannot assign privileges or status. Disabling an account revokes sessions. All mutations require exact Origin and session CSRF token. No CORS grant is configured.

| Role | Scope | Read/download | Mutations |
|---|---|---|---|
| Legal Manager | Organization + provisioned departments | Full scoped record/archive | Create, draft/share, internal approval, release, verify/close, hold/retention/deletion proposal; organization privacy intake review |
| Legal staff | Assigned Legal owner + department | Assigned record/archive | Draft/share, release after manager approval, verify/close |
| Sales | Assigned Sales or own request + department | Metadata for own requests; only assigned Sales downloads latest explicitly shared draft | Assigned Sales sending/changes/version-specific confirmation; create request |
| Operations | Assigned Operations or own request + department | Metadata for own requests; only assigned Operations downloads exact released final | Acknowledge, print, dispatch, signed-original upload and receipt; create request |
| Accounts/technical reviewer | Own submitted request + department | Own metadata; no document downloads | Create request; own privacy intake |
| Administrator | Organization user accounts | Organization account directory and account-specific access history; no implicit legal metadata/files/export | Create/edit users, assign role/departments, reset local temporary passwords, link verified Google identities, revoke sessions, remove/restore accounts; self-access changes blocked |
| Auditor | Organization + provisioned departments | Scoped metadata, archive, scoped audit/export | No workflow writes; own privacy intake |

Cross-organization record IDs return not found. Same-organization forbidden assignment returns forbidden. Lists, search, clients and exports apply the same scope; documents independently load and authorize the parent record. Sales can never download original scans, unpublished or superseded drafts through the API; Operations receives only released draft bytes. Legal and scoped auditors retain full archive. Downloaded files cannot be recalled.

Roles are single-purpose in this foundation. Legal Manager approval authority is a proposed policy requiring company approval. The authenticated administrator dashboard now permits audited role and department changes for other accounts. It requires a reason and the current account revision, revokes sessions, and keeps self-access changes and removal blocked. New administrators require an explicit administrator grant; an active administrator is retained. Trusted local provisioning remains the initial bootstrap path. Review staff role/dept access regularly and disable leavers.

Audit entries include actor ID, action/target, decision and server UTC timestamp; the UI displays IST. Record reads, search, export, download and workflow decisions are recorded, and authorization denials are recorded where the actor is known. The PostgreSQL runtime records anonymous denials in the fixed workspace security audit context. No document payload, password, OAuth token, webhook secret or integration body is logged. This database is not an immutable external audit system; privileged local operators could tamper with it. Production needs centralized access-controlled append-only logging and separation of duties.

Integration ingress uses HMAC and a configured source/org identity, independent of staff sessions. It accepts only lead.created/deal.closed, validates timestamp/signature and persists a receipt keyed by source/external record/event ID plus body hash. Replay returns the existing receipt; changed-payload ID reuse conflicts. It does not create tickets or mutate staff records until mapping/validation adapters are implemented. Outbound workflow events are transactionally queued in the durable outbox; no external delivery worker is implemented.

## Department-specific workspace update — 28 October 2026

The signed-in workspace now carries a global business-department context across task counts, registers, clients, audit and exports. Users with one granted department open directly in it; multi-department users may choose only from their provisioned grants or view all permitted departments. The selected context is a filter, not a permission grant. Direct record/document access still independently enforces organization, department and assignment.

A provisioned functional `team` is separate from `departments`: Sales and Operations map to their functional teams; Accounts, Software and R&D use the request-reviewer role plus an explicitly provisioned team. Non-Legal request creation derives that team from the server identity rather than trusting the browser form. Legacy reviewer accounts without a specific team remain labeled Technical review until separately provisioned; their permissions do not expand. The local initial migration adds the team column to existing user tables with an empty default; named new accounts store the team explicitly. Colleague lookup is restricted to overlapping permitted business departments, and explicit unauthorized department queries are rejected.

The hosted preview has fictional Legal Manager, Legal staff, Sales, Operations, Accounts, Software team, R&D, Administrator and Auditor profiles with example department grants. These are simulated personas, not production users or permission assignment controls. Reviewer profiles track their sample own requests without agreement-file or workflow rights; administrators see administration rather than legal registers; auditors are read-only. No role, record or document access is granted merely by selecting a department in a browser.

## Common drafts and standard agreement starting authority

Legal staff can create/edit common masters in their permitted departments; Legal Manager alone publishes or withdraws a master with publication evidence. Sales can read/download only active published versions in its organization/departments. Administrators, Operations and request reviewers do not gain library access. Scoped auditors can inspect the library without mutations.

A published master is standing Legal authorization for assigned Sales to prepare an initial client copy after recording a closed lead, source creation date and closure evidence. The backend derives department/type from the master and Sales owner from the session. It pins master ID/version/hash/publication actor/time, freezes substituted client document bytes and retains the original lead clock. This deliberately supersedes the old requirement that Legal individually draft/share every initial standard document. It does not approve that client's final commercial agreement. Legal Manager approval plus client-version confirmation are still mandatory before Legal releases to Operations.

The org/lead/template tuple prevents duplicate starts; conflicting business-detail fingerprints are rejected. Revisions and publications of a common master do not mutate existing client files or approvals. New client-specific Legal revisions still require explicit resharing and fresh client confirmation. Withdrawals stop new library use/download, but cannot revoke downloaded copies or silently recall existing client agreements.

## User and credential management — 5 November 2026

Canonical runtime: `production/`, migration 2. Admins can create named users, edit display names/roles/departments/teams/status, revoke sessions, remove/restore accounts and review account access history. User management routes remain unavailable to Legal/Sales/Operations/reviewers/auditors. Admins retain no default document or master-library access.

Local password accounts receive random temporary passwords, shown once, valid for 24 hours. A restricted session allows only self-password change, account metadata and logout until the password is changed. A new password requires the current secret and revokes all previous sessions. Admin resets invalidate the old password and all sessions. No password/hash/salt appears in the directory or audit history. Production passwords/MFA stay in Google Workspace; this application only links independently verified subjects, removes bindings and revokes application sessions.

Removal is reversible account deletion: inactive, marked removed, password invalidated, Google bindings and sessions removed. Legal records and historical actor references are retained. Restore produces a disabled account with no reinstated credential; review access, issue/link a credential and activate separately. Reusing a removed account ID for another person is prevented.
