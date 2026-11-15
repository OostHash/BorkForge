# Changelog

All notable changes to BorkForge will be documented in this file.

> **BorkForge 1.0.0 is a work in progress.** Nothing listed under
> `Unreleased` represents a stable release yet.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 1.0.0 WIP

### Added

- A pnpm workspace for the frontend and repository tooling.
- A Cargo workspace for the native backend.
- New frontend, including its design system, reusable primitives, application shell,
  screens, overlays, and mock development environment.
- Frontend quality tooling with ESLint, Prettier, Vitest browser tests,
  Playwright accessibility and visual suites, and generated design tokens.
- Central `dev`, `build`, `check`, test, and Tauri commands at the repository
  root.
- A Windows-aware CI workflow for frontend builds and Rust checks.
- Pinned Node.js, pnpm, and Rust toolchain versions.
- Shared EditorConfig and rustfmt configuration.

### Changed

- Reorganized the application into `src/frontend` and `src/backend`.
- Replaced the inherited frontend with the component-based React Aria,
  Tailwind CSS, and TanStack implementation.
- Backend change so the production Tauri commands,
  window lifecycle, overlays, diagnostics, and application state use the same
  contract as the new frontend.
- Moved frontend source code into `src/frontend/src` and Rust source code into
  `src/backend/src`.
- Renamed internal workspace packages and the native executable for BorkForge.
- Updated updater and issue-reporting links to `OostHash/BorkForge`.
- Normalized the Rust backend with rustfmt.
- Updated repository documentation for the new layout and root commands.

### Removed

- Legacy maintainer-specific issue templates, slash-command automation, and
  editor configuration.
- The inherited Git history; BorkForge now starts from a single source-snapshot
  root commit while retaining the GPLv3 license and attribution.

## Imported baseline - FrameForge 4.5.0 (2026-11-15)

### Added

- Initial BorkForge source snapshot based on FrameForge 4.5.0.
