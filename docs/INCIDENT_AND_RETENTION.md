# Incident, retention and data-flow operations — review required

## Incident runbook

1. Record discovery timestamp, source, affected systems, suspected data categories and scope; preserve access logs, document hashes, version IDs and relevant infrastructure evidence. Never paste credentials/document contents into incident logs. Restrict the incident record to authorized responders.
2. Contain exposure: revoke compromised sessions, disable account access as needed, isolate affected services/keys and preserve forensic evidence. Do not delete held contracts or evidence. The development UI can disable users through an administrator, but infrastructure containment is an operational task.
3. Immediately notify designated internal security and Legal owners using the approved channel. These contacts are not supplied. Determine whether a covered CERT-In reportable incident is involved and track its six-hour reporting clock from notice/discovery; do not wait for exhaustive analysis. Prepare a minimal factual incident record and update it as facts develop.
4. Authorized company incident owners submit required reports through approved official channels. The app sends nothing externally. Separately assess applicable DPDP duties and commencement, contractual notices and other sector rules; do not substitute a CERT-In report for them.
5. Recover from tested backups, verify permissions and document integrity, retain relevant evidence under hold, reconcile outbox/integration receipts, and conduct a reasoned review with action owners. Approve affected-person communications separately.

Reference: https://www.cert-in.org.in/Directions70B.jsp and the linked 28 April 2022 directions. Confirm applicable later clarifications and incident classification with company counsel/security.

## Retention schedule proposal — not one global expiry

| Data | Proposed handling / owner decision |
|---|---|
| Contracts, originals, negotiations and approval evidence | Legal-approved contract/statutory retention; individual review date; litigation holds override deletion. No contract expiry is automatically set by this foundation. |
| Security/ICT access and decision logs | For covered CERT-In entities maintain rolling 180 days securely within Indian jurisdiction; preserve longer where another rule or incident hold requires. Production central shipping/retention is pending. |
| General application diagnostics | Proposed 30-day budgeted retention, no secrets or document bodies; review with privacy/security. Do not classify security logs as disposable diagnostics. |
| Privacy/grievance requests | Privacy owner sets retention after response/appeal and applicable duties; keep rationale/authority evidence, avoid excessive identity proof. |
| Integration receipts/outbox | Retain enough redacted ID/hash/status evidence for replay, reconciliation and disputes; agreed ERP/business schedule needed. Do not retain inbound payload secrets. |
| Backups | Proposed RDS automated 7-day recovery window in Mumbai, subject to owner approval and restore testing; legal contract retention remains separate. Approved deletion must cover backup expiry and re-deletion after restoration. |

A Legal Manager can set an agreement review date, place/release a hold with rationale and propose deletion only for a closed record with expired reviewed retention and no hold. The code never deletes contract content. A production purge worker needs dual authorization, proof of scope, backup/object-version handling and a durable deletion audit before it is enabled.

## Processor and integration inventory

| Component | Data flow | Current state / review |
|---|---|---|
| Local Node/SQLite runtime | Users, records, document ciphertext, audit, session hashes | Runs on loopback; private runtime key file; no verified production residency or managed backup |
| Sites owner-private preview | Fictional generated demo only | Existing URL retained; memory-only demo; no verified India residency; never upload real company data |
| Google Workspace OIDC | Authorization code and verified identity claims server-side | Approved domain chargemod.com; OAuth client/domain governance and explicit subject provisioning pending; provider processing locations/terms need review |
| AWS Mumbai RDS / S3 / logging | Proposed production database, private documents, logs/backups | Template only, no resources provisioned and adapters not connected; ap-south-1 fixed target |
| Internal ERP | Signed minimal event IDs/hash receipts; version-specific outbound events | HMAC ingress and transactional outbox implemented locally; entity mapping, delivery/retry/dead-letter/reconciliation workers pending |
| Malware scanner / email notifications / e-signature | No current data flow | Not connected; do not imply scans, messages or electronic execution occur |

Complete vendor/processor agreements, support-access review, key policies, region restrictions, account isolation, disaster recovery and retention ownership before real data use.
