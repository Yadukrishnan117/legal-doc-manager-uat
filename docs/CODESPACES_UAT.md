# Legal Doc Manager by 72BPM — GitHub Codespaces UAT

This is the GitHub-hosted replacement for the paused Railway UAT. It runs the full login, administrator management, department RBAC, common-draft workflow and recovery-code features. Use fictional TXT documents only. Production approval and India hosting remain separate requirements.

## Created UAT workspace — 18 November 2026

- Codespace: [refactored space journey](https://github.com/codespaces/refactored-space-journey-jj746w4r77q4359r4)
- Private application: https://refactored-space-journey-jj746w4r77q4359r4-8788.app.github.dev/
- Machine: 2 cores, 8 GB RAM. Port 8788 remains Private.
- Account: `uat.admin`; initial password is in `.runtime/codespaces/refactored-space-journey-jj746w4r77q4359r4/first-login.txt` inside this Codespace. No password or key is included in this guide.

The full 34-test suite and GitHub build checks passed for source `0c33533ec5c20c17e717a7c04ee39585d61c84a8`. Through authenticated private HTTP forwarding, database readiness and administrator login returned 200; password change was required; sign-out returned 200. Anonymous account and recovery-code access returned 401. The same private settings and database survived Codespace shutdown/resume. The verification tunnel was closed afterward; no SSH server was added.

**Current network access limitation:** this computer's configured DNS resolver returned REFUSED for the private preview hostname; an independent DNS lookup resolved the GitHub tunnel normally. Chrome therefore could not open the private application preview on this network during handoff. The app itself is healthy. Ask the network administrator to permit the required `app.github.dev` preview domain, or access it on an approved network where it resolves. No DNS settings, security filters or port visibility were changed.

The Codespace uses a 30-minute idle timeout and a 30-day retention period as reported by GitHub at handoff. Resume it from the Codespace link when stopped. Retention/deletion removes test data; keep your own private backups. This is a fresh UAT workspace, not a migration of the paused Railway volume.

## Open your private UAT

1. Open the private repository in GitHub, select **Code → Codespaces → Create codespace on main**. Choose the smallest machine meeting 2 CPUs and 4 GB memory. Review the account's included usage and billing controls before creating it.
2. Setup installs dependencies and starts the app automatically. The terminal prints an HTTPS app URL and the path to `first-login.txt`. Open that file in the Codespaces editor for the newly generated `uat.admin` temporary password. It must be changed within 24 hours.
3. Open port **8788** from the editor's **Ports** panel. Keep its visibility **Private**. GitHub sign-in protects the preview in addition to application login. Other GitHub users cannot access an owner-private port; sharing requires a separate visibility decision.
4. Set your own password, then open **Account security** and generate/save recovery codes privately. Use **Forgot password?** with one unused code when needed.

The app URL has the form `https://<codespace-name>-8788.app.github.dev`. GitHub displays the actual URL after creation. If automatic startup did not finish, run `npm run start:codespaces` in the Codespaces terminal. The launcher reuses an existing server and private settings; it does not reset accounts on restart.

## Data and credentials

This is a fresh, isolated UAT database with a new encryption key and temporary administrator. Railway accounts, uploaded files and database records are **not migrated**. The old Railway service remains offline, and its attached volume is unchanged. Moving those records would require separately authorized access to the paused host and a verified export/import.

Each Codespace keeps its data and private settings in the repository's ignored `.runtime/codespaces/<codespace-name>/` directory under `/workspaces`. Files there persist when the same Codespace stops/starts or its container is rebuilt. **Deleting the Codespace, or automatic retention deletion, removes its data.** It is not a managed production database or an independent backup. Keep the original encryption key with any private backup; the launcher refuses to replace a missing key when data already exists.

Only the one-time login file contains the initial password for the user. The private settings file contains the data key; never publish or commit it. Generated files are mode 0600 and their directory is mode 0700. Runtime files, logs, keys and credentials are ignored by Git and excluded from source/image packages. No secret values are committed or printed in startup logs.

## Availability and cost

Codespaces is an interactive UAT/development environment, not continuous production hosting. It stops on idle timeout and platform lifetime limits. Resume it from GitHub to bring the same app URL and database back. It uses the owner's included compute/storage quota, and paid usage may apply according to the account's billing limits. Do not increase spending, change payment settings, disable idle shutdown or make the port public just to keep UAT online.

## Verification and updates

CI tests the launcher origin checks, stable encryption keys, first-login requirements and existing application security checks. Before using a new Codespace, verify HTTPS readiness and private-port login. To update it, pull the reviewed main branch, install dependencies if the lock file changed, then stop/start or rebuild the Codespace. Do not open its embedded database from two processes at once. Keep a private backup before schema changes.

References: [Codespaces persistence](https://docs.github.com/en/codespaces/developing-in-a-codespace/persisting-environment-variables-and-temporary-files), [private forwarded ports](https://docs.github.com/en/codespaces/reference/security-in-github-codespaces), [Codespaces lifecycle](https://docs.github.com/en/codespaces/about-codespaces/understanding-the-codespace-lifecycle).
