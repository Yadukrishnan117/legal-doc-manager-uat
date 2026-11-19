# UAT deployment and access report

**Application:** Legal Doc Manager by 72BPM  
**Owner:** Yadukrishnan117  
**Report date:** 19 November 2026  
**Source repository:** https://github.com/Yadukrishnan117/legal-doc-manager-uat  
**Repository visibility:** Private  
**Application source revision reviewed:** ab2a5fdfe13792df0d9423725942f849dce57170

## Current status

The existing private repository already contains the application source. No duplicate repository or source visibility change is needed.

At the owner's request, the old Codespaces application port 8788 was changed from public to private and the Codespace was instructed to stop. The Codespace and its persistent files have not been deleted. Hosting migration is incomplete until a replacement backend is selected, deployed and verified.

**Replacement UAT URL:** Not yet provisioned.  
**GitHub Pages:** Not enabled; publishing the existing application as static files would not provide a functioning authenticated UAT workspace.  
**Requested deployment target:** The owner reiterated deployment in the Yadukrishnan117 GitHub account. Source and CI can remain there, but no separate backend host has been selected or authorized. GitHub Pages alone cannot run the current authenticated application.

## Reported cross-device failure

The supplied mobile screenshot displays `DNS_PROBE_FINISHED_NXDOMAIN` for the former `app.github.dev` preview address. This indicates a DNS resolution failure on that device or network, before an application login request can reach the server. Making a Codespaces port public does not fix DNS resolution.

A narrowly scoped DNS workaround previously made preview access work on the owner's Mac. That machine-specific change does not apply to other testers' phones or networks. No claim is made that the failing phone's resolver was independently inspected.

Codespaces also has an idle shutdown policy and a maximum session lifetime. These make a development preview unsuitable as a dependable shared UAT host. The existing Codespace retains its 30-minute idle timeout; the attempted timeout update was not applied by GitHub.

References:
- https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-timeout-period-for-github-codespaces
- https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle

## Why a GitHub repository alone cannot host this application

GitHub Pages serves static HTML, CSS and JavaScript. This application requires a running Node.js backend, a persistent database and private object storage for:

- Server-side password authentication, sessions, recovery codes and CSRF validation.
- Role, department and assignment authorization.
- Shared agreements, approved draft versions and workflow transitions.
- Audit history and encrypted document storage.

A static role switcher or passwords embedded in JavaScript would not preserve these controls. No such replacement has been introduced.

GitHub can remain the private source and CI repository while Railway or AWS runs the backend. A stable HTTPS application URL on the selected host should replace the retired preview address. Keeping frontend and API on the same application origin avoids introducing unnecessary cross-origin authentication changes.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## Data and account preservation

The former Codespace is `refactored-space-journey-jj746w4r77q4359r4`. Its runtime files are under:

`/workspaces/legal-doc-manager-uat/.runtime/codespaces/refactored-space-journey-jj746w4r77q4359r4`

The database, encrypted objects and matching encryption key must be preserved together if this UAT dataset is migrated. An older Railway database must not be overwritten without a deliberate backup and migration plan. Codespaces retention policies still apply; a stopped Codespace is not a long-term backup.

The existing team test accounts are:

| Account | Role | Business department |
| --- | --- | --- |
| uat.sales | Sales | Station Management |
| uat.legal | Legal Manager | Station Management |
| uat.operations | Operations | Station Management |

These accounts are currently associated with the Codespaces dataset. They must not be described as available on a replacement host until migrated or explicitly reprovisioned there. Temporary password expiry is independent of hosting availability. Passwords, recovery codes, encryption keys and runtime files are excluded from this report and repository.

## Replacement deployment requirements

1. Confirm the backend host and any required paid hosting plan.
2. Back up the source and destination UAT datasets before any migration.
3. Preserve encrypted objects and their matching key, or explicitly choose a fresh fictional UAT dataset.
4. Deploy the existing backend from this repository with persistent storage and an exact HTTPS `APP_ORIGIN`.
5. Configure private secrets through the host's secret manager; never commit them.
6. Verify readiness and anonymous API rejection, then verify Sales, Legal Manager and Operations sign-ins and department restrictions.
7. Test the actual HTTPS URL on desktop and mobile, including a separate network, without a machine-specific DNS rule.
8. Verify an approved-draft-to-client-copy workflow and the Legal-to-Operations handoff using fictional test data.
9. Publish the verified replacement URL and credential handoff instructions here.
10. Retire the Codespace permanently only after migration and backup verification, with explicit approval before deleting its data.

## Validation performed for this report

- Confirmed repository ownership and private visibility through GitHub.
- Confirmed the source revision identified above.
- Confirmed the old Codespace was running with a 30-minute idle timeout before retirement.
- Changed only the old UAT app port to private and requested Codespace shutdown.
- Reviewed GitHub's official hosting and lifecycle documentation.

Replacement-host deployment, migrated-data validation and cross-device testing remain pending. This report does not claim that the hosting issue has been fully resolved.
