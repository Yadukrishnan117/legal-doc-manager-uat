# GitHub Pages workflow demo

## Scope

The owner approved a static demo on 19 November 2026. `pages-demo/index.html` contains fictional, browser-tab-only Sales, Legal Manager and Operations workflows. The team selector is a simulation, not authentication or secure RBAC. No real passwords, database, API or client documents are included. Public sample credentials drive the demo sign-in only. Reload or Reset demo restores the fictional sample records.

The backend source remains in this same repository for future development. The Pages workflow uploads **only `pages-demo/`**; it does not publish backend files, repository documentation or runtime secrets as website assets. This does not make repository source private if the repository itself is later made public.

## Publishing status

**Published:** https://yadukrishnan117.github.io/legal-doc-manager-uat/

The owner explicitly authorized making the entire repository and history public after GitHub rejected Pages for the private repository on the current plan. Before the change, Gitleaks 8.30.1 scanned all 14 commits and found no detected secrets; a separate history path check found no runtime databases, keys or credential files. No scanner can guarantee absence of every possible secret.

The repository is now public. Pages uses GitHub Actions and HTTPS. Deployment run 44502627535 succeeded and the live public demo was verified in Chrome on 19 November 2026.

For updates: edit `pages-demo/`, then run **Publish GitHub Pages workflow demo** on `main` in Actions. Only that directory is uploaded. Review the workflow's returned URL and verify it after deployment.

No backend or secure authentication has been deployed by this workflow. The owner selected demo sign-in. Use these public sample accounts:

| Team | Account | Demo password |
| --- | --- | --- |
| Sales | sales.demo | Demo72BPM! |
| Legal Manager | legal.demo | Demo72BPM! |
| Operations | operations.demo | Demo72BPM! |

The entry screen opens the matching dashboard and hides the team selector. Switch team / sign out returns to the entry screen while retaining this tab's fictional workflow so testers can follow handoffs. Reload ends the demo session and restores sample records. This is browser-side simulation, not secure RBAC. Do not use real account passwords.

## Custom domain later

No placeholder CNAME or domain has been configured. All demo assets are inline and links within the app are relative, so the same artifact works at the GitHub project subpath or a custom-domain root.

After choosing a domain:

1. Verify domain ownership in GitHub account settings before attaching it to the repository.
2. Set the repository's Pages custom domain and configure the DNS records shown by GitHub.
3. For a subdomain, point its CNAME to `yadukrishnan117.github.io`, without a repository path. For an apex domain, use GitHub's current documented records.
4. Wait for DNS and certificate provisioning, enable Enforce HTTPS and test the domain from a separate network.
5. Keep any CNAME file added to `pages-demo/` consistent with the domain configured in Pages settings. Do not include a placeholder domain.

Official references:
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

A custom domain changes the website address; it does not add a backend, login or shared persistence to the demo.
