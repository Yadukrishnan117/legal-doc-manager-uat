# Common-draft workflow and UX rework — 29 October 2026

## User's updated operating model

The common draft library is the normal starting point. Legal maintains reusable masters and explicitly publishes the version Sales may use. After closing a lead, Sales prepares a client-specific copy from that published master and records sending it. Legal does not need to draft or re-share the same standard master for every lead. This replaces the earlier per-lead initial Legal drafting requirement for standard published templates only. Custom agreements and client-requested edits still require Legal.

Common draft and client agreement are separate entities. Each prepared client copy is immutable by version, stores source template ID/version/hash/publication actor/time and original lead creation timestamp, and belongs to one scoped request/agreement. New master versions do not rewrite existing client copies. Superseded library links do not expose older common masters to Sales; previously downloaded files cannot be revoked. Draft master edits remain unpublished until Legal Manager publication.

Client changes are recorded by assigned Sales against the sent version. Legal revises the client document and explicitly reshares; Sales retains its previous shared copy until then. New version confirmation must be recorded. Client confirmation and Legal Manager internal approval remain separate; Legal releases the exact approved final to Operations. Operations records acknowledgement, printing, method/tracking/destination/date of dispatch and signed-original receipt with scan/date/custody. Legal alone verifies original/version/signatures/custody and closes. Original receipt alone never closes an agreement.

## Design critique and resulting changes

| Observed source of confusion | UI decision |
|---|---|
| Role and department pickers dominated ordinary screens | Keep workspace identity visible; move fictional role switching into Preview settings; use department as a local data filter |
| Legal and Sales saw similar screens and many disabled buttons | Task-specific home screens and only available next actions; show current owner explicitly |
| No distinction between common source and client document | Dedicated Common drafts library, separate prepare-client-copy action, visible pinned source version |
| Department cards and four KPI tiles competed with actual work | Remove department-card dashboard; prioritize the queue and three relevant compact counts |
| Full commercial details and history overwhelmed the handoff | Put these in expandable sections; emphasize current client copy and next action |
| CRM demo seemed detached from work | Explain the specific closed-lead → common draft → Sales review contract; no live connector claim |

Labels are action-oriented: Common drafts, Use for closed lead, Prepare client copy, Record sent to client, Send requested changes to Legal, Approve exact final, Release final to Operations, Verify original & close. Routine screens keep privacy and integration configuration out of the main task path.

## What actually runs

Protected local backend: encrypted common masters and version history; department/organization/role guards; Legal editing and Legal-Manager-only publishing/withdrawal; authenticated published-master downloads for Sales; closed-lead validation; immutable client copy creation; original lead clock; provenance; duplicate start prevention; normal negotiation/final-approval/execution gates. Duplicate lead/template requests return the existing agreement only for the same request fingerprint; conflicting business details are rejected.

The local self-service assembly supports approved TXT placeholders: client_name, site, scope, currency, amount, unit, revenue_share, basis, setup_fee, maintenance_fee, maintenance_frequency. Only this allowlist is substituted from validated client/commercial values. PDF masters can be stored/downloaded, but automatic PDF/Word personalization is not implemented; the UI directs Sales to Legal for a client-specific copy. Production scanning, approved common wording and document-generation adapters remain prerequisites. No real master agreement files were supplied or invented as legally approved documents.

The hosted Site is a separate fictional in-memory design preview. It demonstrates common draft publication, prepared client copies and negotiation handoffs with sample TXT placeholders. Real file bytes, named authentication and server permission checks run only in the local application. No production data should be entered into the preview.

## Future in-house CRM contract

Today Sales records lead reference, original creation date and closure evidence manually. A future signed deal.closed event should map source/customer/site/commercials/owner to a master client and eligible common draft, then present a candidate for Sales to verify. Never auto-send an email or imply client acceptance from CRM status. Keep source/external lead/event IDs, fingerprint conflicts and durable outbox reconciliation. The existing backend ingress stores authenticated event receipts pending mapping review; it does not create agreements or call a CRM. No vendor-specific CRM, endpoint, credentials or schema has been configured.

## Remaining policy and production decisions

Which common drafts/types are self-service; who may publish; approved editable fields and deviation thresholds; exact client signature/approval authority; PDF/Word generation; final CRM event/schema/routing; Google OAuth/AWS adapters and operational hardening. Existing privacy, Mumbai residency target and launch limitations remain unchanged. A published common draft is authorization to prepare the initial client copy, not internal approval of that client's final commercial agreement.
