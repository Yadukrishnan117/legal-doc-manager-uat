# Administrator management verification — 5 November 2026

`npm run test:all`: **25 passed, 0 failed** after the user-management increment. Tests cover administrator-only CRUD/credential APIs, CSRF, first-login password restrictions, expiry, required password change, invalidation of old passwords/sessions, stale edits, role/department validation, verified unique Google bindings, production password-reset denial, organization boundaries, reversible removal/restoration and preserved legal records. Existing legal workflow/storage/OIDC regressions also pass.

Browser QA in a disposable local workspace verified administrator navigation, responsive people cards, create-user role/department form, persisted user creation, a one-time temporary credential panel and credential-management choices. No browser script errors were reported. The temporary panel was dismissed before saving `outputs/administrator-create-user.png`. Disposable QA accounts/data are removed. Browser refresh of the main workspace was blocked by browser URL policy; the new bootstrap administrator's first-login screen was not manually verified in that tab. Its underlying first-login API flow passed automated tests. No new password was entered for the user's real local administrator.

At the user's explicit request, one temporary administrator was provisioned in the actual local runtime, with a 24-hour expiry and mandatory password change. Plaintext credentials are delivered separately, excluded from source packages and never hardcoded. No live Google/AWS production verification or deployment occurred.

---

# Current verification — 5 November 2026

`npm run test:all`: **23 passed, 0 failed**. Eleven original workflow/security regressions plus twelve PostgreSQL-runtime and adapter checks. Embedded PostgreSQL runs with a restricted role and forced RLS. Fixtures cover department and assignment denials, admin separation, exact-version negotiation/execution, master publication/client-copy pinning, idempotent starts, stale writes, encrypted objects, scan failures, login/CSRF/cookie flags, session revocation, durable failed-login limits, trusted role changes, S3 SDK protocol, ClamAV INSTREAM protocol and signed OIDC nonce/domain/state validation.

Browser QA verified the login at the default desktop viewport and 390×844 mobile width, successful Sales and Legal Manager logins with disposable fictional accounts, role-specific navigation, common-library empty state and persisted creation of a fictional master entry. Final staff screen reported no browser script errors. Inline styles were moved into CSS to retain the strict content-security policy. QA accounts and runtime are deleted after testing. Login screenshots are in `outputs/rbac-login.png` and `outputs/rbac-login-mobile.png`.

No real Google OAuth exchange, AWS IAM/KMS/S3 access, native RDS connection, multi-instance deployment, Docker build/cloud CI run, external audit shipping or backup restore drill has been performed. No production readiness or legal compliance certification is claimed. See `docs/PRODUCTION_RUNTIME.md` for launch requirements. The separate static Sites demo has not been republished in this increment.

---

## Historical verification

# Verification — 28 October 2026

## Protected local application

`npm test`: **7 tests passed, 0 failed**. Each test contains multiple scope/workflow assertions:

- Organization/department/assignment isolation; administrator has no implicit legal-record access; reviewer/auditor role-write denials.
- Sales cannot retrieve unpublished or superseded document bytes; Legal retains the immutable original archive while new drafts are prepared.
- Negotiation loop and exact-version client confirmation; separate Legal Manager approval required before release; Operations acknowledgement/print/dispatch/original-scan/office-receipt gates; only Legal verifies signatures/version/custody then closes.
- Privacy-request scope and manager review; erasure is not automatic contract deletion. Legal holds and retention gate deletion proposals.
- Google claim checks reject unverified email, wrong hosted domain, audience, nonce, issuer and expired claims. Live Google exchange/JWKS integration was not tested without credentials.
- Real HTTP missing-auth/Origin/CSRF denials, trusted actor derivation despite injected requester/role/status fields, scoped export denial, unauthorized status mutation, admin separation, immediate account deactivation/session revocation, signed integration ingress and duplicate event handling.
- Database persistence across reopen; document ciphertext differs from plaintext; authenticated decryption returns original bytes; invalid PDF content rejected.

Expected production startup refusal verified with `NODE_ENV=production npm start`. Infrastructure JSON parses locally; AWS service-side template validation/deployment was not attempted. Node24 built-in SQLite emits its experimental API warning.

Local browser QA used disposable, randomly credentialed fictional fixtures, not shipped logins. Verified sign-in, authenticated task workspace, explicit draft-share confirmation and resulting status, privacy request submission plus manager review, and no captured JavaScript console errors in inspected flows. Checked mobile at 390×844 and restored viewport; sign-out, brand and navigation remain available and tables scroll horizontally. Desktop/mobile screenshots are in outputs. Guided local provisioning script syntax checked; its interactive terminal path was not automated.

## Design preview

Renamed browser title and visible product to Legal Doc Manager by 72BPM, with Charge Point retained as workspace. Local browser inspection confirmed the My tasks label, Access & privacy role matrix, separate runtime/preview disclosures, chargemod.com domain, AWS Mumbai target and review-needed notices. Preview script syntax passed and captured browser error log was empty. Demo records now live only in memory and reset on reload; no real records or backend authentication are connected to the Site.

## Limits

Google OAuth client credentials and approved callback/hostname, AWS resources, production PostgreSQL/S3/scanning adapters and operational controls are unconfigured. Server currently binds loopback only and refuses production. Local metadata and audit database are not wholly encrypted or externally tamper resistant. Production retention/incident response, MFA policy, backups, immutable logs, queue delivery/retries/dead letters, account lifecycle and public privacy/grievance process need completion. Document content uploads were tested at the store/API layer; browser OS file chooser was not exercised in this revision. The protected API workflows were not exercised on Sites because it hosts only the design preview. The product is not certified as legally compliant.

## Department-view revision

Additional server tests cover explicit department filter rejection, direct cross-department record/download/create denial, scoped colleague discovery, and server-derived functional team despite a forged form team. The suite now contains 9 passing tests. Browser verification confirms the Software team has a fixed Software department view and no document download/workflow actions. Additional persona/department checks are recorded in the revision handoff; production deployment limitations above remain unchanged.

Protected UI department checks also passed with disposable users: the Software reviewer opened directly into its sole granted Software department with only its own white-label request; Legal Manager could select Station Management and see only that department's record/counts. Hosted-preview browser checks confirmed Sales/Software empty state, administrator's no-document administration screen, and auditor's read-only agreement controls. No real staff permissions were changed.

## Common-draft workflow redesign — 29 October 2026

11 automated tests passed (0 failed), including two new library suites. Assertions cover Legal-only editing, Legal-Manager-only publication, unpublished/new-draft isolation from Sales, latest published source downloads, scoped library access, closed-lead validation, immutable client-copy bytes and provenance, original SLA lead clock, duplicate start replay/conflict handling, source update/withdrawal behavior, and the independent final approval/release gate. Existing authorization and physical-execution tests still pass.

Browser QA: Sales selected a published common draft, entered a closed lead, prepared a separate sample client copy, recorded sending and submitted client changes; the new record appeared in Legal's action queue. Protected local app browser QA also prepared and saved a client draft from a published encrypted master with lead/source provenance and current Sales download access. The design preview and protected app remain separate. No real client files, emails or CRM calls were used. Master upload/publication security was exercised through real store tests; live Google/AWS/CRM and automatic PDF/Word assembly remain unverified/unconfigured.

Responsive redesign check: the common draft library was inspected at desktop (1280-wide) and mobile (390-wide) breakpoints with captured screenshots; the viewport was restored afterward. Sales and protected-app inspected flows returned no captured JavaScript console errors. Decorative document blocks were removed to keep the draft action closer to the library title.
