# GitHub Pages workflow demo

## Scope

The owner approved a static demo on 19 November 2026. `pages-demo/index.html` contains fictional, browser-tab-only Sales, Legal Manager and Operations workflows. The team selector is a simulation, not authentication or secure RBAC. No passwords, database, API or real client documents are included. Reload or Reset demo restores the fictional sample records.

The backend source remains in this same repository for future development. The Pages workflow uploads **only `pages-demo/`**; it does not publish backend files, repository documentation or runtime secrets as website assets. This does not make repository source private if the repository itself is later made public.

## Publishing status

GitHub rejected Pages creation for the existing private repository with HTTP 422: “Your current plan does not support GitHub Pages for this repository.” The repository has not been made public. No live Pages URL has been verified yet.

Resolve this by activating a GitHub plan that supports Pages from private repositories, or explicitly approving publication of the entire repository and its history. Publishing a website does not by itself authorize exposing all repository source.

Once eligible:

1. In repository Settings → Pages, select **GitHub Actions** as the source.
2. In Actions, select **Publish GitHub Pages workflow demo** and run it on `main`.
3. Wait for the deployment to succeed and use the URL returned by the workflow.
4. Test all three team views and a sample workflow from another device/network.

The expected default project-site address is `https://yadukrishnan117.github.io/legal-doc-manager-uat/`; this is an expected address, not proof of publication. Updates are published deliberately using Run workflow.

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
