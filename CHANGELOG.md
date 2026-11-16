# Changelog

All notable changes to BorkForge will be documented in this file.

> **BorkForge 1.0.0 is a work in progress.** Nothing listed under
> `Unreleased` represents a stable release yet.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 1.0.0 WIP

## Borkforge

### Added

- A new BorkForge anvil-and-ears mark with matching app and installer icons.

### Changed

- Renamed the application from FrameForge to BorkForge throughout product
  metadata, window names, notifications, network user agents, diagnostics, and
  temporary filenames.
- BorkForge now uses its own configuration, data, cache, and Windows Credential
  Manager namespaces. It no longer imports FrameForge data automatically, so
  both applications can coexist.
- The BorkForge updater now uses its own release endpoint and signature
  verification key.
- Rebuilt the application shell and every main screen around one consistent,
  responsive design system with shared navigation, controls, cards, tables,
  dialogs, popovers, and loading, empty, and error states.
- Reorganized the application into clearer work areas: Foundry combines
  equipment and syndicates; Inventory contains items, Prime Sets, and Mods &
  Arcanes; Market contains trading and reports; Relics contains the collection
  and planner; and Rivens contains the analyzer and owned rivens.
- Added system, dark, and light themes; normal and high contrast; a
  colour-blind palette; three interface densities; and text scaling from 80% to
  200%.
- Standardized searching, sorting, filtering, pagination, card and list views,
  image visibility, and reusable filter presets across the catalogue screens.
- Redesigned Settings as a tabbed dialog with grouped controls for General,
  Overlays, Market, Filters, Data, and Debugging.
- Reworked the header around account, update, memory scanner, warframe.market,
  and data-cache status. Report a bug and Settings now live at the bottom of
  the main navigation.
- Rebuilt the inventory changelog as a collapsible, searchable, resizable dock
  with a live change feed, Inventory shortcuts, and an optional separate
  window.
- Reworked the Modular Window with reorderable tracking, favourites, timers,
  and fissures; docked resizing; a separate-window mode; and a persistent
  collapsed rail.
- Rebuilt the relic reward, relic pick, and riven comparison overlays and their
  settings previews to use the same visual and accessibility system as the main
  application.
- Added a custom Windows title bar with standard window controls and native
  Windows 11 Snap Layout support.
- Improved narrow-window layouts, keyboard navigation, focus visibility,
  screen-reader labels, reduced-motion behaviour, and Windows forced-colour
  support.

### Removed

- FrameForge donation and Discord links.

### Platform

- Implemented the new frontend platform with React Aria, Tailwind CSS, and
  TanStack and connected it to the Rust/Tauri backend through a shared command
  contract.
- Separated the frontend and backend into pnpm and Cargo workspace packages
  under `src/frontend` and `src/backend`.
- Added central `dev`, `build`, `check`, test, Tauri, and unsigned installer
  commands.
- Added ESLint, Prettier, Vitest browser tests, Playwright accessibility and
  visual suites, generated design tokens, EditorConfig, and rustfmt rules.
- Added Windows-aware CI and pinned Node.js, pnpm, and Rust toolchain versions.
- Moved the Kitchen sink and Tokens development pages into Settings →
  Debugging.
- Condensed the README and updated repository documentation for the new layout,
  commands, installation, provenance, and licensing.
- Removed obsolete slash-command automation and editor-specific configuration.
- A per-machine NSIS installer that installs BorkForge under `Program Files`,
  registers an uninstaller, blocks downgrades, and installs WebView2 when
  needed.
- GitHub issue forms for structured bug reports and feature requests.

## Imported baseline - FrameForge 4.5.0 (2026-11-15)

### Added

- Created the initial BorkForge source snapshot. The upstream Git history was
  not imported; the GPLv3 license and attribution were retained.
