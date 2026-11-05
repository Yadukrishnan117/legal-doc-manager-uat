# Charge Point legal portal — implementation handoff

This artifact is a static interactive prototype. No ERP, user directory, document store, queue or database is connected. All records are fictional. Browser-local persistence is per browser/origin; role switching is UI simulation, not security. Downloaded document samples are plain-text placeholders, not legally usable agreements or immutable historical copies. Selected attachment names are recorded without uploading their content.

## Proposed production architecture

Use Node.js + TypeScript for the API and server-side adapters, PostgreSQL for transactional records and immutable version metadata, and private document object storage. This backend is proposed, not implemented. Separate business department from submitting team. Model master clients, external identity mappings, department-client references, legal tickets, agreements, immutable document versions, version-specific shares, client confirmations, internal approvals, execution milestones and audit entries.

Enforce authentication and least privilege on every backend query, mutation and document download. Legal retains version history; assigned Sales can retrieve only the latest explicitly shared version; Operations can retrieve only the exact released final. Never trust the browser role selector. Atomically revoke older portal download grants when resharing. Previously downloaded copies cannot be revoked. Use short-lived server-authorized document URLs and private storage; virus-scan uploads, enforce MIME/size rules and record hashes. Preserve document bytes and their version metadata; the prototype's text downloads do not do this.

## Inbound ERP contract — illustrative, pending schema

POST /api/integrations/{source}/events

Use service authentication plus HMAC-signed raw-body webhooks (timestamp, key ID, signature) with replay windows, rotation and constant-time signature verification, or an agreed equivalent such as mTLS/OAuth client credentials. Secrets belong in server-side secret storage and never browser settings, source, logs or localStorage. Allowlist source identifiers and server-owned routing. Validate schema, currency, decimal ranges, units, customer identities and authorized employee mappings before accepting a request.

Example envelope:

```json
{
  "eventId": "evt-unique-204",
  "type": "deal.closed",
  "occurredAt": "2026-10-27T06:30:00Z",
  "source": "cp-internal-erp",
  "externalRecordId": "DEAL-204",
  "customerId": "CUSTOMER-123",
  "payload": {
    "department": "Software",
    "submittingTeam": "Sales",
    "siteId": "SITE-12",
    "ownerEmployeeId": "EMP-45",
    "commercialTerms": {
      "scope": "White-label mobile application",
      "revenueSharePercent": "5.00",
      "calculationBasis": "Subscription receipts excluding tax",
      "payer": "Client",
      "payee": "Charge Point",
      "perUnitAmount": "20.00",
      "currency": "INR",
      "unit": "active user / month",
      "setupFee": "250000.00",
      "maintenanceFee": "25000.00",
      "maintenanceFrequency": "monthly"
    }
  }
}
```

Use a unique idempotency key on (source ERP, external record ID, event ID); store body hashes to detect key reuse with changed payloads. Persist inbound acceptance and durable work in a transaction before returning 202 with a receipt ID; return the same receipt for an identical duplicate, and 409 for conflicting reuse. Map (source, external customer ID) to master client ID and (source, external lead/deal ID) to legal ticket/agreement. Do not match clients solely by company name. Quarantine ambiguous identities for human resolution. One deal can generate multiple agreements only under an explicit agreed rule.

## Outbound contract and reliable delivery

Emit agreement.updated, client.confirmed and agreement.executed with an immutable event ID, sequence, timestamp, source/external IDs, master client ID, department-client reference, ticket ID, agreement ID and exact document version/hash. Do not embed document contents or contact details by default. Write state changes and an outbox row in the same database transaction. A durable queue worker delivers signed authenticated events with exponential backoff/jitter, bounded retries and a dead-letter queue. Support operator replay using the original event ID, endpoint health, reconciliation jobs and delivery receipts; at-least-once delivery requires recipient idempotency. Use request correlation IDs and redacted audit metadata; redact secrets and personal data from logs. Retention and access policy require business approval.

## State and approval guarantees

Only an explicit Legal share changes Sales's visible version. A new Legal revision invalidates approval/confirmation for the new version while preserving older evidence in immutable history. Confirmation captures version ID/hash, evidence, actor and event date. Separate internal approval captures approver authority and version. Legal release requires both on the exact final version and prevents silent revision after release; production correction/recall needs an explicit controlled process.

Operations acknowledges, prints, dispatches with method/tracking/destination/date, then records signed-original receipt with scan/date/custody. Receipt creates a Legal verification task; it does not close. Legal checks exact final version, all required signatures and custody evidence before marking Fully Executed/Closed. Record each milestone separately with authenticated actor, server timestamp and event evidence; display IST.

Proposed automations: deal closed → legal request; explicitly shared revision → Sales task; current client confirmation plus approval and Legal release → Operations task; original receipt → Legal verification; Legal closure → ERP update; SLA breach → escalation. None runs unattended in this prototype.

## Decisions needed before production

Confirm ERP schemas/authentication/endpoints and data owners; client deduplication policy; agreement numbering; CPP category mapping; hardware types; approval/signatory authority; exact SLA start, calendar versus working days, holidays/pauses and notification recipients. The demo proposes a 4-calendar-day target and 7-day limit from lead creation, without resetting on handoff. Deployment date and sample lead dates determine displayed overdue state.

## Local artifact

Open dist/index.html directly for the standalone prototype, or serve dist with any static HTTP server. No dependency installation or build is required. Reset via Workspace settings; export via the agreement register. The hosted site and local file use separate browser storage.

## Update — 28 October 2026

The product is now **Legal Doc Manager by 72BPM**. The earlier static-only statement applies to the hosted design preview. A separate runnable protected local backend now exists; see README and docs/DEPLOYMENT.md for what actually runs. Confirmed identity target is Google Workspace hosted domain **chargemod.com**, with explicit provisioned subjects/roles. Confirmed infrastructure target is AWS Mumbai **ap-south-1**. No live credentials or production adapters have been configured. The hosted design preview remains a simulation with memory-only fictional records and no verified India residency.

Backend ingress /api/integration/events authenticates a dedicated configured source/org using HMAC-SHA256 and a five-minute timestamp window, accepts lead.created/deal.closed envelopes (externalId/eventId/type), stores a source/external/event key and exact raw-body hash, returns 202 pending_mapping_review, and returns the prior receipt on replay. Conflicting body reuse returns 409. It deliberately does not create legal records until the ERP entity schema and scoped mapping adapter are approved. Workflow events are transactionally recorded in outbox; delivery/retry/dead-letter/reconciliation workers are still pending. This is a foundation, not a claim of live connection.
