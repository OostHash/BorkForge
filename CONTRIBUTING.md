# Contributing to HexDesk

Thanks for your interest in HexDesk. This document describes how work is
planned, developed, reviewed and released. Everything in the repository and on
GitHub — code, comments, commits, issues, pull requests and docs — is written
in English.

## Setting up

Requirements (versions are pinned in the repository):

- Windows 10 or 11 (x64)
- Node.js 24 (see `.node-version`) and pnpm 11.25.0
- Rust 1.97.0 with the MSVC toolchain (see `rust-toolchain.toml`)
- The [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for
  Windows

```bash
pnpm install
pnpm --filter @hexdesk/frontend exec playwright install chromium
pnpm desktop:dev
```

`pnpm dev` runs only the frontend in a browser, which is quicker for UI work.

## Project layout

- `src/backend` — Rust crate and Tauri application.
- `src/frontend` — React + TypeScript UI (Vite, Vitest, Playwright).
- `.github/workflows` — CI checks and the release workflow.

## Planning

- Work is tracked in GitHub issues. Every change starts with an issue; use the
  bug report or feature request template.
- Each version has a milestone (for example `v1.1.0`). An issue's milestone is
  the version it ships in. Unscheduled ideas go to the `Later` milestone.
- Issues carry an `area:` label for the part of the app they touch.
- The [HexDesk Roadmap](https://github.com/users/OostHash/projects/2) project
  shows progress with the statuses New, Ready, In progress and Done.
- Versions are large minor releases (1.1, 1.2, …) without deadlines. A version
  is released when its milestone is done.

## Branches

| Branch           | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `master`         | Released code only. Every commit here is a released version. |
| `release/x.y`    | Development of the next minor version. One at a time.      |
| `hotfix/x.y.z`   | Urgent patch on top of a release, branched from `master`.  |
| `feat/…`, `fix/…`| Short-lived topic branches for a single issue.             |

- Topic branches start from the active `release/x.y` branch and are merged
  back into it through a pull request.
- A hotfix branches from `master`, is released, merged into `master`, and then
  `master` is merged into the active `release/x.y` branch so the fix is not
  lost.
- Name topic branches after the issue: `feat/12-collapsible-navigation`,
  `fix/31-stale-prices`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) with a short,
lower-case, imperative subject:

```
fix: read prices from the HexDeskPricing mirror

Closes #31
```

Types in use: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `ci`,
`chore`. Keep each commit focused on one change.

## Pull requests

Before opening a pull request:

- [ ] It is linked to an issue (`Closes #…`) and targets the right branch.
- [ ] `pnpm check` passes locally (format, lint, typecheck, all tests,
      `cargo fmt --check`, `cargo check`).
- [ ] Behaviour changes have tests; UI changes were checked in the running
      app, with screenshots in the PR when the look changed.
- [ ] User-visible changes have an entry under `## [Unreleased]` in
      `CHANGELOG.md`.
- [ ] No secrets, tokens, logs with player names, or `.hexdesk-dev/` data are
      included.

Pull requests are merged by the maintainer once CI is green and the review is
done.

## Code style

- Formatting is automatic: run `pnpm format` (Prettier and `cargo fmt`).
  Settings live in `.editorconfig`, the Prettier config and `rustfmt.toml`.
- ESLint must pass with no warnings ignored without a comment explaining why.
- Do not add, remove or upgrade dependencies, or change the pinned toolchain,
  in an unrelated pull request.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Write entries for users: what changed for them, not how the code changed.

## Releasing

Releases are made by the maintainer.

1. Make sure the milestone is complete and the release branch is green.
2. Set the new version in all three places:
   `src/backend/tauri.conf.json`, `src/backend/Cargo.toml` and
   `src/frontend/package.json`.
3. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`
   and add a fresh empty `## [Unreleased]` above it.
4. Merge the release (or hotfix) branch into `master`.
5. Tag the merge commit `vx.y.z` and push the tag. The release workflow checks
   that the tag matches the app version, runs `pnpm check`, and builds a signed
   draft release.
6. Review the draft release on GitHub and publish it.
7. Close the milestone and create the next `release/x.y` branch.

## License

By contributing you agree that your contributions are licensed under the
project's license (see `LICENSE`).
