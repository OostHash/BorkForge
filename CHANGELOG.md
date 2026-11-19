# Changelog

All notable changes to HexDesk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An activity console in Settings → Console shows what HexDesk does in the
  background as it happens. Filter by level and by source, open an entry to
  see its details and the reason it failed, follow one inventory scan or
  overlay from start to end, and copy lines for a bug report.
- A one-click diagnostics export in Settings → Debugging and in the console
  saves a single zip with the logs, your settings and facts about your system
  to your Downloads folder, ready to attach to a bug report. Passwords,
  tokens, e-mail addresses and player names are removed from it.
- The navigation sidebar can collapse to icons only. Click the empty space
  between the screens and Report a bug to collapse or expand it; HexDesk
  remembers your choice. When collapsed, hover or focus an icon to see its
  name. HexDesk starts collapsed, and narrow windows always show icons only.

### Changed

- New navigation icons for Inventory, Foundry, Relics, Rivens, Timers and
  Market that match their screens, shown larger in the sidebar.
- The collapsed modular window shows its name along the bar, and clicking
  anywhere on the bar opens it again.
- The logs now say why something failed instead of only that it failed, for
  example when Warframe's memory could not be read, no inventory was found,
  warframe.market refused a request, or a relic overlay took long to appear.
  Repeated identical lines are collapsed into one line with a count.
- Error messages for warframe.market actions now name what failed and how
  warframe.market answered.
- Your Windows user name and player names no longer appear in log files.
- Settings → Debugging now only holds the diagnostics export. What the old
  tools wrote to separate files is in the log and the activity console.

### Removed

- The old debugging tools from Settings → Debugging: the overlay log, relic
  captures, manual capture, inventory snapshots, memory probe, raw memory
  record, memory relic debug, the relic pick OCR and overlay tests, the EE.log
  tail, unmatched paths and the incoming batch preview. Inventory items the
  catalogue cannot place are now listed in the log instead.
- The Session log button on the Rivens screen; riven reads are in the
  activity console.
- The separate session and debug files HexDesk wrote to your temporary folder.
  Debug files that earlier versions left behind, such as inventory snapshots,
  memory dumps, captures and session logs, are deleted when HexDesk starts.

## [1.0.1] - 2026-11-17

### Fixed

- Bulk prices for relic values, relic recommendations and price lists were up
  to a month out of date, because the FrameForge pricing mirror stopped
  updating on 2026-10-14. HexDesk now reads prices and ducat exceptions from
  its own mirror, [HexDeskPricing](https://github.com/OostHash/HexDeskPricing),
  which refreshes from relics.run twice a day.

### Changed

- The licence notice now names HexDesk. A new `NOTICE` file records authorship:
  the frontend was written for HexDesk, the backend is derived from FrameForge
  4.5.0.

## [1.0.0] - 2026-11-17

### Added

- Introduced the approved HexDesk emblem as scalable SVG artwork, dark and
  light application icons, transparent black and white exports, Windows icon
  assets, and a 1280 × 640 GitHub social preview.
- A free, open-source Windows desktop companion for Warframe under the HexDesk
  identity: “The Origin System, Connected.”

### Changed

- Renamed the application from FrameForge to HexDesk throughout product
  metadata, window names, notifications, network user agents, diagnostics, and
  temporary filenames.
- HexDesk uses its own configuration, data, cache, and Windows Credential
  Manager namespaces. It no longer imports FrameForge data automatically, so
  both applications can coexist.
- The HexDesk updater uses its own release endpoint and signature
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
- A per-machine NSIS installer that installs HexDesk under `Program Files`,
  registers an uninstaller, blocks downgrades, and installs WebView2 when
  needed.
- GitHub issue forms for structured bug reports and feature requests.

## Imported baseline - FrameForge 4.5.0 (2026-11-15)

### Added

- Created the initial HexDesk source snapshot. The upstream Git history was
  not imported; the GPLv3 license and attribution were retained.
