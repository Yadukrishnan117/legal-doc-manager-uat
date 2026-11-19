# UAT deployment report

**Application:** Legal Doc Manager by 72BPM  
**Updated:** 19 November 2026  
**Owner:** Yadukrishnan117  
**Repository:** https://github.com/Yadukrishnan117/legal-doc-manager-uat  
**Repository visibility:** Public, explicitly authorized by the owner  
**Public demo:** https://yadukrishnan117.github.io/legal-doc-manager-uat/

## Outcome

The owner approved a static GitHub Pages demo in the same repository. The demo is published and was verified in Chrome. GitHub Actions run [44502627535](https://github.com/Yadukrishnan117/legal-doc-manager-uat/actions/runs/44502627535) completed successfully from source commit a0412034502b1a08b6213e259a5a1a96c4c6cd35.

Sales, Legal Manager and Operations views use fictional sample records and browser-tab-only workflow simulations. The demo identifies its limitations on screen. There is no secure login, server-enforced RBAC, shared database, real CRM, email or document-signature service. Reload restores sample state. The original backend source remains available in the repository for future development.

## GitHub configuration

- Pages source: GitHub Actions.
- Workflow: `.github/workflows/pages-demo.yml` (manual Run workflow).
- Published artifact: only `pages-demo/`.
- HTTPS enabled; no custom domain or placeholder CNAME configured.
- Inline assets and relative application navigation support both the repository subpath and a future custom-domain root.

See [GitHub Pages demo guide](docs/GITHUB_PAGES_DEMO.md) for publishing updates and custom-domain instructions.

## Repository visibility and audit

GitHub initially rejected Pages creation with HTTP 422 because the current plan did not support Pages from this private repository. The owner then explicitly authorized making the entire repository, including backend source and commit history, public.

Before changing visibility, the checksum-verified official Gitleaks 8.30.1 release scanned all 14 commits (about 549 KB) and reported no detected secrets. A separate history path check found no runtime database, key, first-login or private settings files. The audit is a useful check, not a guarantee against every possible disclosure. Runtime credentials and real documents were not added to the Pages artifact or deployment report.

## Verification

- JavaScript syntax checked successfully.
- Locally exercised Sales common draft selection and client-copy preparation.
- Verified Legal review and Operations execution queues.
- Verified reload restores fictional state.
- Checked phone layout at 390 × 844 and restored the default viewport.
- Verified the live public Pages URL renders the demo in Chrome.
- GitHub Actions reported successful deployment.

## Former Codespaces deployment

The supplied phone screenshot showed `DNS_PROBE_FINISHED_NXDOMAIN` for the old `app.github.dev` preview address. This was a device/network DNS failure before application authentication. Making the preview public did not solve cross-device DNS resolution or Codespaces idle shutdown limits.

At the owner's request, the former Codespaces port was made private and the Codespace stopped. Its runtime data was not deleted; platform retention still applies. The former authenticated test accounts belong to that dataset and are not GitHub Pages credentials. No Railway deployment was performed for this publication.

## Future secure application

GitHub Pages serves static files. Real password verification, sessions, enforced role/department access, shared workflows and encrypted document storage require a backend. Adding a custom domain changes the address; it does not add those capabilities. The current request for a login screen is awaiting clarification between demo sign-in and a real backend deployment.

References:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
