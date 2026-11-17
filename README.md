<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="assets/branding/hexdesk-logo-white.svg"
    >
    <source
      media="(prefers-color-scheme: light)"
      srcset="assets/branding/hexdesk-logo.svg"
    >
    <img
      src="assets/branding/hexdesk-logo.svg"
      width="132"
      alt="HexDesk emblem"
    >
  </picture>
</p>

<h1 align="center">HexDesk</h1>

<p align="center"><strong>The Origin System, Connected.</strong></p>

HexDesk is a free, open-source desktop companion for Warframe. It combines
inventory and mastery tracking, market tools, timers, relic overlays, and riven
analysis in one local app. Built by Tenno, for Tenno.

## Highlights

- **Inventory and Foundry** — track owned items, mastery, crafting requirements,
  Forma, relic drops, and favourites.
- **Market and Trading** — browse warframe.market prices, manage listings, copy
  whispers, and record completed trades.
- **Relics and Overlays** — compare relic value and show reward information
  in-game using Windows OCR.
- **Timers** — follow world cycles, resets, fissures, alerts, invasions, Baro,
  Nightwave, and other live events.
- **Rivens** — analyse rolls and compare stat quality.
- **Statistics** — review trade history, platinum activity, and inventory changes.

Most features work without an account. A warframe.market account is only needed
for listing and trading features.

## Safety and Privacy

HexDesk does not modify Warframe, inject code, or write to the game process.
The optional inventory scanner uses read-only process memory access and is
disabled until you enable it. Third-party tools are always used at your own risk.

App data is stored locally. HexDesk has no telemetry and sends no data to a
HexDesk server. Network access is used for public Warframe/community data,
warframe.market features, and update checks. Saved warframe.market credentials
are stored in Windows Credential Manager.

## Requirements

- Windows 10 or 11 (64-bit)
- Warframe installed for live inventory scanning
- A warframe.market account for optional trading features

## Installation

1. Download the latest Windows installer from [Releases](../../releases).
2. Run it. SmartScreen may warn for unsigned releases; choose
   **More info → Run anyway** only if you trust the download.
3. Launch HexDesk from the Start menu.

The installer places HexDesk in `C:\Program Files\HexDesk`, requests
administrator approval, and registers it with Windows so it can be removed
through **Installed apps**.

## Building From Source

Install Node.js 24+, pnpm, Rust, and the MSVC toolchain, then run:

```powershell
git clone https://github.com/OostHash/HexDesk.git
cd HexDesk
pnpm install
pnpm check
pnpm desktop:dev
```

## Project Status

HexDesk is an independent opinionated version of
[FrameForge 4.5.0](https://github.com/WyrmStudios/FrameForge). It uses its own
application identity and storage, so it can be installed alongside FrameForge.

Bug reports and feature requests are welcome through
[GitHub Issues](../../issues).

## License

HexDesk is licensed under [GPLv3](LICENSE). The frontend was written for
HexDesk; the backend is derived from FrameForge 4.5.0. See [NOTICE](NOTICE)
for copyright and authorship details.

HexDesk is not affiliated with Digital Extremes Ltd. Warframe is a trademark
of Digital Extremes Ltd.
