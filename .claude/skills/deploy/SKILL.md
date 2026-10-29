---
name: deploy
description: Release this plugin and update its Paseo registry listing. Bumps the version in package.json, tags and pushes it, creates a GitHub release, and opens a PR on getpaseo/plugins that pins the release commit. Use when the user says "배포해줘", "배포", "릴리스", "release", or "deploy".
---

# Deploy paseo-agent-team

"배포해줘" authorizes every step below, including the push, the GitHub release and the registry PR. Stop and report instead of continuing when a check fails.

## 1. Preflight

All of these must hold; otherwise stop and report what is wrong:

- On `main`, the working tree is clean, and `git fetch` shows `main` equals `origin/main`.
- `npm run typecheck` and `npm test` pass.
- There are commits since the last tag (`git describe --tags --abbrev=0`). If there is no tag yet, compare against the registry's pinned commit (step 5).
- `OVERVIEW.md` and README "Limitations" still describe the shipped behaviour. If a commit since the last release changed behaviour that they describe, update them first and get the user's OK on the wording.

## 2. Record the version

Use the bump level the user names (patch, minor, major). If they name none, use `patch`, and say so in the report.

```bash
npm version <level> --no-git-tag-version   # updates package.json and package-lock.json
git commit -am "Release v<version>"
git tag v<version>
git push origin main v<version>
```

`paseo-plugin.json` has no version field; do not add one.

## 3. GitHub release

Build the notes from the commit subjects since the previous tag (or since the registry pin for the first release):

```bash
git log --format='- %s' <previous>..v<version>~1
gh release create v<version> --repo gyuha/paseo-agent-team --title "v<version>" --notes "<notes>"
```

## 4. Check the release installs

Do not touch the `paseo-agent-team` plugin installed on this host. Run the same build the registry runs by installing the tag under a throwaway id, then remove it:

```bash
paseo plugin add git:gyuha/paseo-agent-team --ref v<version> --id paseo-agent-team-release-check
paseo plugin ls      # must be "running" with no error
paseo plugin remove paseo-agent-team-release-check
```

If it fails (for example the server runtime boundary rejecting an import), stop: the release is broken, so fix it and release the next patch rather than pinning it.

## 5. Update the registry listing

The listing is `plugins/gyuha/agent-team.json` in `getpaseo/plugins`. It pins one Git commit and is never updated automatically. Update it with a PR on that record. Do not use the submission issue form: `gh issue create --label` from this account drops the label, so the intake bot ignores it.

First check that `gh pr list --repo getpaseo/plugins --author gyuha --state open` shows no open bump for `agent-team`. If one exists, comment the new commit on it instead of opening another.

Work in a new empty temp directory:

```bash
gh repo fork getpaseo/plugins --clone=false
git clone https://github.com/gyuha/plugins.git <tmp>/plugins
cd <tmp>/plugins
git remote add upstream https://github.com/getpaseo/plugins.git
git fetch upstream && git checkout -b bump/agent-team-<sha7> upstream/main
```

In `plugins/gyuha/agent-team.json` change only:

- `artifact.commit` and `repository.commit` → the full SHA of the release commit (`git rev-parse v<version>^{commit}`).
- `reviewedAt` → the current UTC time as `YYYY-MM-DDTHH:MM:SSZ`.

Leave `submittedAt`, `publishedAt`, `categories` and `listing` unchanged. `listing.media` stays pinned to its old image commit unless the screenshot changed.

Validate, then open the PR (registry tooling needs Node 22.18+):

```bash
npm ci --ignore-scripts && node scripts/validate.ts --changed --base upstream/main
git commit -am "bump: gyuha/agent-team → <sha7>"
git push -u origin bump/agent-team-<sha7>
gh pr create --repo getpaseo/plugins --head gyuha:bump/agent-team-<sha7> --title "bump: gyuha/agent-team → <sha7>" --body "<body>"
```

Body: one line naming the new commit and `v<version>`, the release notes as an `Includes:` list, and the validate result.

## 6. Report

Report to the user:

- The version.
- The tag.
- The GitHub release URL.
- The registry PR URL.
- Whether the bump level was the default.

Say plainly that `paseo plugin add gyuha/agent-team` installs the new version only after the registry PR is merged. Until then, `paseo plugin add git:gyuha/paseo-agent-team` installs the latest `main`.
